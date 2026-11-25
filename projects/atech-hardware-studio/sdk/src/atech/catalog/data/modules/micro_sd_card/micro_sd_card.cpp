/**
 * @file micro_sd_card.cpp
 * @brief microSD card storage module implementation for Atech
 *
 * All card access goes through a mutex, because the optional logger task
 * writes from core 0 while application code reads from core 1. Without it a
 * read issued mid-write returns garbage or wedges the bus.
 */

#include "micro_sd_card.h"
#include <stdarg.h>
#include <string.h>
#include <ctype.h>
#include "esp_task_wdt.h"

MicroSDCard* MicroSDCard::_owner = nullptr;

// A queued log line. Fixed size so the queue is a flat block allocated once at
// beginLogger() — no heap churn on the logging path, which is the whole point
// of having a logging path.
struct LogItem {
    char text[MicroSDCard::LOG_LINE_MAX];
};

static void loggerTaskTrampoline(void* param) {
    ((MicroSDCard*)param)->_loggerTaskLoop();
}

MicroSDCard::MicroSDCard(int csPin, int sclkPin, int mosiPin, int misoPin)
    : _csPin(csPin)
    , _sclkPin(sclkPin)
    , _mosiPin(mosiPin)
    , _misoPin(misoPin)
    , _spiHost(HSPI)
    , _frequency(20000000)
    , _mounted(false)
    , _busStarted(false)
    , _spi(nullptr)
    , _mutex(nullptr)
    , _loggerTask(nullptr)
    , _logQueue(nullptr)
    , _flushIntervalMs(2000)
    , _searchDirBudget(256)
    , _searchTruncated(false)
    , _loggerRunning(false)
    , _loggerStopped(true)
    , _droppedLines(0)
    , _writtenLines(0)
{
    _logPath[0] = '\0';
}

void MicroSDCard::setSpiHost(uint8_t host) {
    if (_busStarted) {
        Serial.println("[SD] setSpiHost() must be called before begin() — ignored");
        return;
    }
    _spiHost = host;
}

// ========== Lifecycle ==========

bool MicroSDCard::begin(uint32_t frequencyHz) {
    if (_owner != nullptr && _owner != this) {
        // One global SD object in the ESP32 core; see the note in the header.
        Serial.println("[SD] A card is already mounted — only one microSD "
                       "module per board is supported");
        return false;
    }

    if (_mutex == nullptr) {
        _mutex = xSemaphoreCreateRecursiveMutex();
        if (_mutex == nullptr) {
            Serial.println("[SD] Could not create mutex");
            return false;
        }
    }

    _frequency = frequencyHz;
    _pinsReversed = false;

    // The SD library needs a hardware SPI host; it cannot bit-bang. Take one
    // from the shared registry (setSpiHost() is a preference), so the card
    // never lands on a host the screen or the camera already owns.
    if (!_hostClaimed) {
        int host = atech::claimSpiHost(_spiHost);
        if (host < 0) {
            Serial.println("[SD] No hardware SPI host free: the card needs one, and "
                           "both are taken (at most two of microSD + camera)");
            return false;
        }
        _spiHost = (uint8_t)host;
        _hostClaimed = true;
    }

    // Try the pins as given, then with the two port pairs swapped.
    //
    // Which of a double module's connectors lands on the lower-numbered board
    // port depends on the module's own layout, and the platform's resolver
    // assumes one answer for every module. Measured on a 14-port board: the
    // camera module matches the resolver, this card is exactly reversed. A
    // card either mounts or it does not, so trying both is unambiguous — far
    // better than picking one and being wrong for half the inventory.
    for (int attempt = 0; attempt < 2; attempt++) {
        if (attempt == 1) {
            _swapPortPairs();
            Serial.println("[SD] No card on the given pins — retrying with the "
                           "port pair order reversed");
        }
        if (!_busStarted) {
            _spi = new SPIClass(_spiHost);
            // Argument order is the ESP32 core's: sclk, miso, mosi, ss.
            _spi->begin(_sclkPin, _misoPin, _mosiPin, _csPin);
            _busStarted = true;
        }
        if (_mountAtAnySpeed(frequencyHz)) {
            _mounted = true;
            _owner = this;
            _pinsReversed = (attempt == 1);
            Serial.printf("[SD] Mounted %s card, %.2f GB, at %lu Hz%s\n",
                          cardType(),
                          cardSizeBytes() / (1024.0 * 1024.0 * 1024.0),
                          (unsigned long)_frequency,
                          _pinsReversed ? " (port pair order reversed)" : "");
            return true;
        }
    }

    Serial.println("[SD] Mount failed — no card, bad wiring, or not FAT32 "
                   "(exFAT is not supported)");
    return false;
}

/** Swap which board port carries CS/SCLK and which carries MOSI/MISO, and drop
 *  the bus so it is rebuilt on the new pins. */
void MicroSDCard::_swapPortPairs() {
    int cs = _csPin, sclk = _sclkPin;
    _csPin = _mosiPin;
    _sclkPin = _misoPin;
    _mosiPin = cs;
    _misoPin = sclk;

    if (_busStarted && _spi) {
        _spi->end();
        delete _spi;
        _spi = nullptr;
        _busStarted = false;
    }
}

bool MicroSDCard::_mountAtAnySpeed(uint32_t frequencyHz) {
    // Cards that mount at 20 MHz on a short lead often need slowing down on a
    // long one. Stepping down costs a few hundred milliseconds at boot and
    // turns an outright failure into a working, slightly slower card.
    const uint32_t speeds[] = { frequencyHz, 10000000, 4000000, 1000000 };
    for (size_t i = 0; i < sizeof(speeds) / sizeof(speeds[0]); i++) {
        if (i > 0 && speeds[i] >= speeds[0]) continue;   // no point retrying faster
        if (_tryMount(speeds[i])) {
            _frequency = speeds[i];
            return true;
        }
    }
    return false;
}

bool MicroSDCard::_tryMount(uint32_t frequencyHz) {
    if (SD.begin(_csPin, *_spi, frequencyHz)) {
        if (SD.cardType() != CARD_NONE) return true;
        SD.end();
    }
    return false;
}

void MicroSDCard::end() {
    endLogger();
    if (_mounted) {
        if (_lock()) {
            SD.end();
            _unlock();
        }
        _mounted = false;
    }
    if (_owner == this) _owner = nullptr;
    if (_busStarted && _spi) {
        _spi->end();
        delete _spi;
        _spi = nullptr;
        _busStarted = false;
    }
}

bool MicroSDCard::remount() {
    if (_mounted) {
        flushLog();
        if (_lock()) {
            SD.end();
            _unlock();
        }
        _mounted = false;
        if (_owner == this) _owner = nullptr;
    }
    return begin(_frequency);
}

// ========== Locking ==========

bool MicroSDCard::_lockRead(uint32_t timeoutMs) {
    if (_mutex == nullptr) return false;
    return xSemaphoreTakeRecursive(_mutex, pdMS_TO_TICKS(timeoutMs)) == pdTRUE;
}

bool MicroSDCard::_lock(uint32_t timeoutMs) {
    if (!_lockRead(timeoutMs)) return false;
    _closeReadCache();
    return true;
}

void MicroSDCard::_closeReadCache() {
    if (_readFile) _readFile.close();
    _readPath = "";
}

void MicroSDCard::_unlock() {
    if (_mutex) xSemaphoreGiveRecursive(_mutex);
}

// ========== Card information ==========

const char* MicroSDCard::cardType() {
    if (!_mounted) return "NONE";
    switch (SD.cardType()) {
        case CARD_MMC:  return "MMC";
        case CARD_SD:   return "SD";
        case CARD_SDHC: return "SDHC";
        case CARD_NONE: return "NONE";
        default:        return "UNKNOWN";
    }
}

uint64_t MicroSDCard::cardSizeBytes() {
    if (!_mounted) return 0;
    return SD.cardSize();
}

uint64_t MicroSDCard::usedBytes() {
    if (!_mounted) return 0;
    return SD.usedBytes();
}

uint64_t MicroSDCard::freeBytes() {
    if (!_mounted) return 0;
    uint64_t total = SD.totalBytes();
    uint64_t used  = SD.usedBytes();
    return used > total ? 0 : total - used;
}

// ========== Whole-file write ==========

bool MicroSDCard::writeFile(const char* path, const uint8_t* data, size_t len) {
    if (!_mounted || path == nullptr) return false;
    if (!_lock()) return false;

    File f = SD.open(path, FILE_WRITE);
    bool ok = false;
    if (f) {
        ok = (len == 0) || (f.write(data, len) == len);
        f.close();
    }
    _unlock();

    if (!ok) Serial.printf("[SD] Write failed: %s\n", path);
    return ok;
}

bool MicroSDCard::writeFile(const char* path, const char* data) {
    if (data == nullptr) return false;
    return writeFile(path, (const uint8_t*)data, strlen(data));
}

bool MicroSDCard::writeFile(const char* path, const String& data) {
    return writeFile(path, (const uint8_t*)data.c_str(), data.length());
}

// ========== Append ==========

bool MicroSDCard::writeAt(const char* path, uint32_t offset, const uint8_t* data, size_t len) {
    if (!_mounted || path == nullptr || data == nullptr) return false;
    if (len == 0) return true;
    if (!_lock()) return false;

    // "r+" is the only mode that opens for update without truncating: FILE_WRITE
    // ("w") would discard the body we are patching the header for.
    File f = SD.open(path, "r+");
    bool ok = false;
    if (f) {
        if (offset + len <= (uint32_t)f.size() && f.seek(offset)) {
            ok = (f.write(data, len) == len);
        }
        f.close();
    }
    _unlock();
    if (!ok) Serial.printf("[SD] writeAt failed: %s @%lu\n", path, (unsigned long)offset);
    return ok;
}

bool MicroSDCard::_appendRaw(const char* path, const uint8_t* data, size_t len) {
    if (!_mounted || path == nullptr) return false;
    if (!_lock()) return false;

    File f = SD.open(path, FILE_APPEND);
    bool ok = false;
    if (f) {
        ok = (len == 0) || (f.write(data, len) == len);
        f.close();
    }
    _unlock();
    return ok;
}

bool MicroSDCard::appendFile(const char* path, const uint8_t* data, size_t len) {
    bool ok = _appendRaw(path, data, len);
    if (!ok) Serial.printf("[SD] Append failed: %s\n", path);
    return ok;
}

bool MicroSDCard::appendFile(const char* path, const char* data) {
    if (data == nullptr) return false;
    return appendFile(path, (const uint8_t*)data, strlen(data));
}

bool MicroSDCard::appendFile(const char* path, const String& data) {
    return appendFile(path, (const uint8_t*)data.c_str(), data.length());
}

bool MicroSDCard::appendLine(const char* path, const char* line) {
    if (!_mounted || path == nullptr || line == nullptr) return false;
    if (!_lock()) return false;

    File f = SD.open(path, FILE_APPEND);
    bool ok = false;
    if (f) {
        // One open/close for line plus newline, so a reader never sees a line
        // without its terminator.
        ok = f.println(line) > 0;
        f.close();
    }
    _unlock();
    return ok;
}

// ========== Read ==========

String MicroSDCard::readFile(const char* path) {
    String out;
    if (!_mounted || path == nullptr) return out;
    if (!_lock()) return out;

    File f = SD.open(path, FILE_READ);
    if (f) {
        size_t len = f.size();
        if (out.reserve(len + 1)) {
            while (f.available()) out += (char)f.read();
        } else {
            Serial.printf("[SD] Not enough RAM for %s (%u bytes) — "
                          "use readBytes()\n", path, (unsigned)len);
        }
        f.close();
    }
    _unlock();
    return out;
}

size_t MicroSDCard::readFile(const char* path, uint8_t* buf, size_t maxLen) {
    if (!_mounted || path == nullptr || buf == nullptr || maxLen == 0) return 0;
    if (!_lock()) return 0;

    size_t n = 0;
    File f = SD.open(path, FILE_READ);
    if (f) {
        n = f.read(buf, maxLen);
        f.close();
    }
    _unlock();
    return n;
}

size_t MicroSDCard::readBytes(const char* path, uint32_t offset,
                              uint8_t* buf, size_t len) {
    if (!_mounted || path == nullptr || buf == nullptr || len == 0) return 0;
    if (!_lockRead()) return 0;

    if (!_readFile || _readPath != path) {
        _closeReadCache();
        _readFile = SD.open(path, FILE_READ);
        if (_readFile) _readPath = path;
    }
    size_t n = 0;
    if (_readFile && (_readFile.position() == offset || _readFile.seek(offset))) {
        n = _readFile.read(buf, len);
    }
    _unlock();
    return n;
}

String MicroSDCard::readLine(const char* path, uint32_t lineIndex) {
    String out;
    if (!_mounted || path == nullptr) return out;
    if (!_lock()) return out;

    File f = SD.open(path, FILE_READ);
    if (f) {
        uint32_t current = 0;
        while (f.available()) {
            String line = f.readStringUntil('\n');
            if (current == lineIndex) {
                // readStringUntil keeps a trailing \r on CRLF files.
                if (line.endsWith("\r")) line.remove(line.length() - 1);
                out = line;
                break;
            }
            current++;
        }
        f.close();
    }
    _unlock();
    return out;
}

uint32_t MicroSDCard::countLines(const char* path) {
    if (!_mounted || path == nullptr) return 0;
    if (!_lock()) return 0;

    uint32_t count = 0;
    File f = SD.open(path, FILE_READ);
    if (f) {
        uint8_t buf[256];
        size_t n;
        bool sawData = false;
        bool endedWithNewline = true;
        while ((n = f.read(buf, sizeof(buf))) > 0) {
            sawData = true;
            for (size_t i = 0; i < n; i++) {
                if (buf[i] == '\n') count++;
            }
            endedWithNewline = (buf[n - 1] == '\n');
        }
        // A trailing fragment with no newline is still a line.
        if (sawData && !endedWithNewline) count++;
        f.close();
    }
    _unlock();
    return count;
}

// ========== Filesystem ==========

bool MicroSDCard::exists(const char* path) {
    if (!_mounted || path == nullptr) return false;
    if (!_lock()) return false;
    bool ok = SD.exists(path);
    _unlock();
    return ok;
}

bool MicroSDCard::remove(const char* path) {
    if (!_mounted || path == nullptr) return false;
    if (!_lock()) return false;
    bool ok = SD.remove(path);
    _unlock();
    return ok;
}

bool MicroSDCard::rename(const char* from, const char* to) {
    if (!_mounted || from == nullptr || to == nullptr) return false;
    if (!_lock()) return false;
    bool ok = SD.rename(from, to);
    _unlock();
    return ok;
}

uint32_t MicroSDCard::fileSize(const char* path) {
    if (!_mounted || path == nullptr) return 0;
    if (!_lock()) return 0;

    uint32_t size = 0;
    File f = SD.open(path, FILE_READ);
    if (f) {
        size = f.size();
        f.close();
    }
    _unlock();
    return size;
}

bool MicroSDCard::mkdir(const char* path) {
    if (!_mounted || path == nullptr) return false;
    if (!_lock()) return false;
    bool ok = SD.mkdir(path);
    _unlock();
    return ok;
}

bool MicroSDCard::rmdir(const char* path) {
    if (!_mounted || path == nullptr) return false;
    if (!_lock()) return false;
    bool ok = SD.rmdir(path);
    _unlock();
    return ok;
}

int MicroSDCard::listDir(const char* path, String* names, int32_t* sizes,
                         int maxEntries) {
    if (!_mounted || path == nullptr || maxEntries <= 0) return 0;
    if (!_lock()) return 0;

    int count = 0;
    File dir = SD.open(path);
    if (dir && dir.isDirectory()) {
        File entry = dir.openNextFile();
        while (entry && count < maxEntries) {
            if (names) names[count] = String(entry.name());
            if (sizes) sizes[count] = entry.isDirectory() ? -1 : (int32_t)entry.size();
            count++;
            entry.close();
            entry = dir.openNextFile();
        }
        if (entry) entry.close();
    }
    if (dir) dir.close();
    _unlock();
    return count;
}

String MicroSDCard::listDirJson(const char* path, int maxEntries) {
    String out = "[";
    if (!_mounted || path == nullptr || maxEntries <= 0) return out + "]";
    if (!_lock()) return out + "]";

    File dir = SD.open(path);
    if (dir && dir.isDirectory()) {
        int count = 0;
        File entry = dir.openNextFile();
        while (entry && count < maxEntries) {
            if (count > 0) out += ",";
            out += "{\"name\":\"";
            out += entry.name();
            if (entry.isDirectory()) {
                out += "\",\"dir\":true}";
            } else {
                out += "\",\"size\":";
                out += String((uint32_t)entry.size());
                out += "}";
            }
            count++;
            entry.close();
            entry = dir.openNextFile();
        }
        if (entry) entry.close();
    }
    if (dir) dir.close();
    _unlock();

    out += "]";
    return out;
}

// ========== Search ==========

// fileContains() streams the file through a window of CHUNK fresh bytes plus
// up to MAX_NEEDLE-1 carried over from the previous read, so the stack buffer
// is bounded and known at compile time.
static const size_t CHUNK      = 256;
static const size_t MAX_NEEDLE = 128;

// Binary-safe substring search. strstr() would stop at the first NUL byte,
// which a log file full of text will not have but an image or a WAV will.
static const uint8_t* findBytes(const uint8_t* hay, size_t hlen,
                                const uint8_t* needle, size_t nlen) {
    if (nlen == 0 || hlen < nlen) return nullptr;
    for (size_t i = 0; i + nlen <= hlen; i++) {
        if (memcmp(hay + i, needle, nlen) == 0) return hay + i;
    }
    return nullptr;
}

bool MicroSDCard::matchGlob(const char* pattern, const char* name) {
    if (pattern == nullptr || name == nullptr) return false;

    // Iterative backtracking rather than the recursive textbook version: this
    // runs inside a directory walk, and recursion depth would be attacker-ish
    // input (a long pattern) driving stack use on a 8 KB task.
    const char* p        = pattern;
    const char* s        = name;
    const char* starP    = nullptr;   // pattern position just after the last '*'
    const char* starS    = nullptr;   // where that '*' started matching

    while (*s) {
        if (*p == '*') {
            starP = ++p;              // remember, and try matching zero chars
            starS = s;
        } else if (*p == '?' ||
                   (*p && tolower((unsigned char)*p) == tolower((unsigned char)*s))) {
            p++;                      // FAT is case-insensitive, so we are too
            s++;
        } else if (starP) {
            p = starP;                // backtrack: let the '*' eat one more char
            s = ++starS;
        } else {
            return false;
        }
    }

    while (*p == '*') p++;            // trailing stars match the empty rest
    return *p == '\0';
}

void MicroSDCard::setSearchBudget(int maxDirs) {
    _searchDirBudget = maxDirs > 0 ? maxDirs : 1;
}

int MicroSDCard::find(const char* root, const char* pattern, FindCallback cb,
                      void* ctx, int maxResults, int maxDepth) {
    _searchTruncated = false;
    if (!_mounted || root == nullptr || pattern == nullptr || cb == nullptr) return 0;
    if (maxResults <= 0) return 0;

    // Breadth-first over a fixed ring of pending directories. One directory
    // handle is open at a time, so depth is not limited by the mount's file
    // handle budget (5) the way a recursive descent would be.
    String pending[MAX_PENDING_DIRS];
    int    pendingDepth[MAX_PENDING_DIRS];
    int    head = 0, count = 0;

    pending[0]      = root;
    pendingDepth[0] = 0;
    count           = 1;

    int  found       = 0;
    int  dirsScanned = 0;
    bool stop        = false;

    // Feed the watchdog only if the calling task actually subscribed to it.
    const bool feedsWatchdog = (esp_task_wdt_status(NULL) == ESP_OK);

    while (count > 0 && !stop) {
        if (dirsScanned >= _searchDirBudget) { _searchTruncated = true; break; }

        String dirPath = pending[head];
        int    depth   = pendingDepth[head];
        head = (head + 1) % MAX_PENDING_DIRS;
        count--;
        dirsScanned++;

        // Lock per directory, not for the whole search: a search over a big
        // card must not lock the logger task out for its entire duration.
        if (!_lock()) { _searchTruncated = true; break; }

        File dir = SD.open(dirPath.c_str());
        if (dir && dir.isDirectory()) {
            File entry = dir.openNextFile();
            while (entry && !stop) {
                if (entry.isDirectory()) {
                    if (depth < maxDepth) {
                        if (count < MAX_PENDING_DIRS) {
                            int tail = (head + count) % MAX_PENDING_DIRS;
                            pending[tail]      = entry.path();
                            pendingDepth[tail] = depth + 1;
                            count++;
                        } else {
                            // Ring full — say so rather than silently pruning
                            // a branch of the tree.
                            _searchTruncated = true;
                        }
                    }
                } else if (matchGlob(pattern, entry.name())) {
                    if (!cb(entry.path(), (uint32_t)entry.size(), ctx)) stop = true;
                    found++;
                    if (found >= maxResults) {
                        _searchTruncated = true;   // there may well be more
                        stop = true;
                    }
                }
                entry.close();
                if (!stop) entry = dir.openNextFile();
            }
            if (entry) entry.close();
        }
        if (dir) dir.close();

        _unlock();

        // Between directories, never mid-listing: yield so the logger and the
        // application task get their turn, and keep the watchdog happy.
        if (feedsWatchdog) esp_task_wdt_reset();
        vTaskDelay(pdMS_TO_TICKS(1));
    }

    if (count > 0 && !stop) _searchTruncated = true;
    return found;
}

// Context for the array-collecting form of find().
struct FindCollect {
    String*  paths;
    int32_t* sizes;
    int      capacity;
    int      n;
};

static bool findCollectCallback(const char* path, uint32_t size, void* ctx) {
    FindCollect* c = (FindCollect*)ctx;
    if (c->n >= c->capacity) return false;
    if (c->paths) c->paths[c->n] = path;
    if (c->sizes) c->sizes[c->n] = (int32_t)size;
    c->n++;
    return c->n < c->capacity;
}

int MicroSDCard::find(const char* root, const char* pattern, String* paths,
                      int32_t* sizes, int maxResults, int maxDepth) {
    FindCollect collect = { paths, sizes, maxResults, 0 };
    find(root, pattern, findCollectCallback, &collect, maxResults, maxDepth);
    return collect.n;
}

// Context for the JSON form.
struct FindJson {
    String* out;
    int     n;
};

static bool findJsonCallback(const char* path, uint32_t size, void* ctx) {
    FindJson* j = (FindJson*)ctx;
    if (j->n > 0) *(j->out) += ",";
    *(j->out) += "{\"path\":\"";
    *(j->out) += path;
    *(j->out) += "\",\"size\":";
    *(j->out) += String(size);
    *(j->out) += "}";
    j->n++;
    return true;
}

String MicroSDCard::findJson(const char* root, const char* pattern,
                             int maxResults, int maxDepth) {
    String out = "[";
    FindJson ctx = { &out, 0 };
    find(root, pattern, findJsonCallback, &ctx, maxResults, maxDepth);
    out += "]";
    return out;
}

bool MicroSDCard::fileContains(const char* path, const char* needle) {
    if (!_mounted || path == nullptr || needle == nullptr) return false;

    size_t nlen = strlen(needle);
    if (nlen == 0) return true;
    if (nlen > MAX_NEEDLE) {
        Serial.printf("[SD] Search text longer than %u bytes\n", (unsigned)MAX_NEEDLE);
        return false;
    }
    if (!_lock()) return false;

    bool found = false;
    File f = SD.open(path, FILE_READ);
    if (f) {
        // Carry the tail of each chunk into the next so a needle straddling a
        // chunk boundary is still found — the bug every naive chunked search
        // has.
        uint8_t buf[CHUNK + MAX_NEEDLE];
        size_t  carry = 0;
        size_t  n;

        while (!found && (n = f.read(buf + carry, CHUNK)) > 0) {
            size_t total = carry + n;
            if (findBytes(buf, total, (const uint8_t*)needle, nlen) != nullptr) {
                found = true;
                break;
            }
            carry = (nlen > 1) ? (nlen - 1) : 0;
            if (carry > total) carry = total;
            if (carry > 0) memmove(buf, buf + total - carry, carry);
        }
        f.close();
    }
    _unlock();
    return found;
}

int MicroSDCard::grepFile(const char* path, const char* needle,
                          String* lines, int maxLines) {
    if (!_mounted || path == nullptr || needle == nullptr ||
        lines == nullptr || maxLines <= 0) return 0;
    if (!_lock()) return 0;

    int n = 0;
    File f = SD.open(path, FILE_READ);
    if (f) {
        uint32_t scanned = 0;
        while (f.available() && n < maxLines) {
            String line = f.readStringUntil('\n');
            if (line.endsWith("\r")) line.remove(line.length() - 1);
            if (line.indexOf(needle) >= 0) lines[n++] = line;

            // A long file is a long loop. Yield periodically so this does not
            // starve the logger while holding the card lock.
            if ((++scanned % 256) == 0) vTaskDelay(pdMS_TO_TICKS(1));
        }
        f.close();
    }
    _unlock();
    return n;
}

// ========== Buffered logging ==========

bool MicroSDCard::beginLogger(const char* path, size_t queueDepth,
                              uint32_t flushIntervalMs) {
    if (path == nullptr) return false;
    if (_loggerRunning) {
        Serial.println("[SD] Logger already running");
        return false;
    }

    strncpy(_logPath, path, sizeof(_logPath) - 1);
    _logPath[sizeof(_logPath) - 1] = '\0';
    _flushIntervalMs = flushIntervalMs;

    if (_logQueue == nullptr) {
        _logQueue = xQueueCreate(queueDepth, sizeof(LogItem));
        if (_logQueue == nullptr) {
            Serial.println("[SD] Could not allocate log queue");
            return false;
        }
    }

    _loggerRunning = true;
    _loggerStopped = false;
    // Core 0 with the other background drivers. Card writes block for tens of
    // milliseconds and must not sit on core 1 with the application task.
    BaseType_t ok = xTaskCreatePinnedToCore(
        loggerTaskTrampoline,
        "SDLogger",
        // 8 KB, not the 4 KB most Atech drivers use. This task calls into the
        // VFS and FATFS layers, which are markedly more stack-hungry than an
        // I2C read — the other drivers' 4 KB is not a precedent for this one.
        8192,
        this,
        1,
        &_loggerTask,
        0
    );

    if (ok != pdPASS) {
        _loggerRunning = false;
        _loggerStopped = true;
        _loggerTask = nullptr;
        Serial.println("[SD] Could not start logger task");
        return false;
    }

    Serial.printf("[SD] Logger writing to %s every %lu ms\n",
                  _logPath, (unsigned long)_flushIntervalMs);
    return true;
}

bool MicroSDCard::logLine(const char* line) {
    if (!_loggerRunning || _logQueue == nullptr || line == nullptr) return false;

    LogItem item;
    strncpy(item.text, line, LOG_LINE_MAX - 1);
    item.text[LOG_LINE_MAX - 1] = '\0';

    // Zero timeout: logging must never block the caller. A full queue means
    // the card is slower than the log rate, and dropping is the honest
    // response — droppedLines() makes it visible rather than silent.
    if (xQueueSend(_logQueue, &item, 0) != pdTRUE) {
        _droppedLines++;
        return false;
    }
    return true;
}

bool MicroSDCard::logLine(const String& line) {
    return logLine(line.c_str());
}

bool MicroSDCard::logPrintf(const char* fmt, ...) {
    char buf[LOG_LINE_MAX];
    va_list args;
    va_start(args, fmt);
    vsnprintf(buf, sizeof(buf), fmt, args);
    va_end(args);
    return logLine(buf);
}

int MicroSDCard::_drainQueue() {
    if (_logQueue == nullptr || !_mounted) return 0;
    if (uxQueueMessagesWaiting(_logQueue) == 0) return 0;
    if (!_lock()) return 0;

    int written = 0;
    // One open/close for the whole batch. Opening per line is what makes naive
    // SD logging slow enough to trip the watchdog.
    File f = SD.open(_logPath, FILE_APPEND);
    if (f) {
        LogItem item;
        while (xQueueReceive(_logQueue, &item, 0) == pdTRUE) {
            f.println(item.text);
            written++;
        }
        f.close();
        _writtenLines += written;
    } else {
        Serial.printf("[SD] Logger could not open %s\n", _logPath);
    }

    _unlock();
    return written;
}

void MicroSDCard::_loggerTaskLoop() {
    while (_loggerRunning) {
        _drainQueue();
        vTaskDelay(pdMS_TO_TICKS(_flushIntervalMs));
    }

    _drainQueue();          // final flush on the way out
    _loggerTask = nullptr;
    _loggerStopped = true;  // volatile, so endLogger() is guaranteed to see it
    vTaskDelete(NULL);
}

bool MicroSDCard::flushLog() {
    if (!_mounted) return false;
    _drainQueue();
    return true;
}

void MicroSDCard::endLogger() {
    if (!_loggerRunning) return;
    _loggerRunning = false;

    // Give the task up to a flush interval plus a margin to finish its final
    // drain and delete itself. _loggerStopped is volatile; the task handle is
    // not, and must not be used as the synchronisation flag.
    uint32_t waited = 0;
    while (!_loggerStopped && waited < _flushIntervalMs + 1000) {
        vTaskDelay(pdMS_TO_TICKS(50));
        waited += 50;
    }

    if (!_loggerStopped) {
        // The task never came back — leave its queue alive rather than
        // deleting a queue it may still be reading from.
        Serial.println("[SD] Logger task did not stop cleanly");
        return;
    }

    if (_logQueue) {
        vQueueDelete(_logQueue);
        _logQueue = nullptr;
    }
}

// ========== Paths and listings ==========

int MicroSDCard::listDir(const char* path, String* names, int32_t* sizes, bool* isDir,
                         int maxEntries) {
    int32_t localSizes[64];
    int32_t* sz = sizes;
    if (sz == nullptr) {
        if (maxEntries > 64) maxEntries = 64;
        sz = localSizes;
    }
    int n = listDir(path, names, sz, maxEntries);
    for (int i = 0; i < n; i++) {
        if (isDir) isDir[i] = sz[i] < 0;
        if (names && names[i].endsWith("/")) names[i].remove(names[i].length() - 1);
    }
    return n;
}

void MicroSDCard::pathJoin(const char* base, const char* name, char* out, size_t outSize) {
    atech::pathJoin(base, name, out, outSize);
}

void MicroSDCard::pathUp(char* path) {
    atech::pathUp(path);
}
