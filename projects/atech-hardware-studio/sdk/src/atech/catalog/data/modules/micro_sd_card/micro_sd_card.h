/**
 * @file micro_sd_card.h
 * @brief microSD card storage module for Atech (SPI)
 *
 * Removable FAT storage on a private SPI bus. Double module spanning two
 * adjacent ports (4 SPI signals).
 *
 * Atech connector (double module) — see
 * hardware/prototyping_line/modules/micro_sd_card.md:
 *   Port 1 Line A: CS    (chip select)
 *   Port 1 Line B: SCLK  (serial clock)
 *   Port 2 Line A: MOSI  (controller -> card)
 *   Port 2 Line B: MISO  (card -> controller, the only output pin)
 *
 * Specifications:
 * - Media:     microSD, FAT16/FAT32 (exFAT is NOT supported)
 * - Interface: SPI, hardware host, 20 MHz default with automatic fallback
 * - Supply:    3.3 V
 *
 * Two things about this module are unlike the sensor drivers:
 *
 * 1. SPI needs a hardware peripheral. Bit-banging at card speeds is not
 *    viable, so this module takes one of the ESP32-S3's two hardware SPI
 *    hosts from the shared registry (modules/atech_spi_hosts.h),
 *    preferring HSPI. Generated setup() reserves hosts for the card and any
 *    camera before the screens start, and a screen that finds none left runs
 *    software SPI. setSpiHost() is only a preference.
 *
 * 2. Writes are slow and blocking — tens of milliseconds, occasionally far
 *    longer when the card runs internal housekeeping. Doing that inline stalls
 *    everything else in the calling task. For anything periodic use the
 *    logger: logLine() drops a line into a queue and returns immediately, and
 *    a background task on core 0 does the blocking write.
 */

#ifndef MICRO_SD_CARD_MODULE_H
#define MICRO_SD_CARD_MODULE_H

#include <Arduino.h>
#include <SPI.h>
#include <FS.h>
#include <SD.h>
#include "atech_spi_hosts.h"
#include "atech_paths.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"

class MicroSDCard {
public:
    /// Longest line logLine() will queue, including the terminator. Longer
    /// lines are truncated rather than dropped.
    static const size_t LOG_LINE_MAX = 128;

    /// Directories a search may hold pending at once. Deeper trees still work
    /// — the walk reports truncation rather than silently skipping them.
    static const int MAX_PENDING_DIRS = 16;

    /**
     * @brief Construct a microSD module
     * @param csPin   Chip select   (Line A of the first port)
     * @param sclkPin Serial clock  (Line B of the first port)
     * @param mosiPin Data to card  (Line A of the second port)
     * @param misoPin Data from card(Line B of the second port)
     *
     * Parameters are in physical pin order, so the pins read straight off the
     * board doc's port table: port N Data A, port N Data B, port N+1 Data A,
     * port N+1 Data B.
     */
    MicroSDCard(int csPin, int sclkPin, int mosiPin, int misoPin);

    // ---- lifecycle ---------------------------------------------------------

    /**
     * @brief Bring up the bus and mount the card
     * @param frequencyHz Initial SPI clock. On failure the driver retries at
     *                    10, 4 and 1 MHz before giving up — a long or noisy
     *                    connection often mounts fine at a lower speed.
     * @return true if a FAT filesystem was mounted
     *
     * Safe to call when no card is inserted: it returns false and leaves the
     * object usable, so a later remount() picks the card up.
     */
    bool begin(uint32_t frequencyHz = 20000000);

    /** @brief Flush the logger, unmount the card, release the SPI bus */
    void end();

    /** @brief Unmount and mount again — call after a card swap */
    bool remount();

    /** @brief True if a card is mounted and ready for file operations */
    bool isMounted() const { return _mounted; }

    /**
     * @brief Choose the SPI host before begin()
     * @param host HSPI (default) or FSPI
     *
     * Use it to put the card on the faster default host and the screen on
     * HSPI. It cannot rescue a board with two displays: ST7735_TFT hands the
     * default host to the first display and HSPI to the second, so both hosts
     * are already spoken for and no setting here frees one.
     */
    void setSpiHost(uint8_t host);

    /**
     * @brief True if begin() had to reverse the port pair order to mount
     *
     * Which of a double module's two connectors lands on the lower-numbered
     * board port is a property of the module's own layout, not of the board,
     * and the platform's pin resolver assumes one answer for every module.
     * Measured on a 14-port board at ports 3+4: this card mounts on
     * (17, 18, 16, 15) while the resolver produces (16, 15, 17, 18) — exactly
     * reversed, while the camera module matches the resolver.
     *
     * So begin() tries the pins it was given and then the reverse. A card
     * either mounts or it does not, which makes the probe unambiguous. This
     * reports which orientation won, so a wrong module definition stays
     * visible instead of being silently absorbed.
     */
    bool pinsWereReversed() const { return _pinsReversed; }

    // ---- card information --------------------------------------------------

    /** @brief "SD", "SDHC", "MMC", "UNKNOWN", or "NONE" if nothing is mounted */
    const char* cardType();

    /** @brief Total card capacity in bytes (0 if unmounted) */
    uint64_t cardSizeBytes();

    /** @brief Bytes used by files on the card */
    uint64_t usedBytes();

    /** @brief Bytes still free on the card */
    uint64_t freeBytes();

    // ---- whole-file read and write ----------------------------------------

    /** @brief Write text to a path, replacing anything already there */
    bool writeFile(const char* path, const char* data);
    bool writeFile(const char* path, const String& data);

    /** @brief Write raw bytes to a path, replacing anything already there */
    bool writeFile(const char* path, const uint8_t* data, size_t len);

    /** @brief Append text to a path, creating the file if needed */
    bool appendFile(const char* path, const char* data);
    bool appendFile(const char* path, const String& data);

    /** @brief Append raw bytes to a path, creating the file if needed */
    bool appendFile(const char* path, const uint8_t* data, size_t len);

    /**
     * @brief Append one line plus a newline
     *
     * Blocking — for periodic logging use logLine() instead.
     */
    bool appendLine(const char* path, const char* line);

    /**
     * @brief Overwrite bytes in place at a byte offset, without truncating
     * @param path   Existing file. This does NOT create one.
     * @param offset Byte offset to write at; must be within the file
     * @param data   Bytes to write
     * @param len    How many
     * @return true if all len bytes were written
     *
     * The write counterpart to readBytes(). Needed by any format that can only
     * fill in a header field once the body is finished — an AVI's total frame
     * count and chunk sizes are the case this exists for. Everything else
     * should use writeFile() or appendFile().
     */
    bool writeAt(const char* path, uint32_t offset, const uint8_t* data, size_t len);

    /**
     * @brief Read a whole file as text
     * @return File contents, or an empty String if the file is missing.
     *         Check exists() first if empty and missing must be told apart.
     *
     * Reads the whole file into RAM. Use readBytes() for anything large —
     * the board has 512 KB and the card holds gigabytes.
     */
    String readFile(const char* path);

    /**
     * @brief Read a whole file into a caller-owned buffer
     * @return Bytes read, 0 on failure. Truncates to maxLen.
     */
    size_t readFile(const char* path, uint8_t* buf, size_t maxLen);

    /**
     * @brief Read len bytes starting at a byte offset — for streaming a large
     *        file through a small buffer
     * @return Bytes actually read (short at end of file), 0 on failure
     */
    size_t readBytes(const char* path, uint32_t offset, uint8_t* buf, size_t len);

    /**
     * @brief Read one line by index, 0-based, without loading the whole file
     * @return The line without its terminator, or an empty String past the end
     */
    String readLine(const char* path, uint32_t lineIndex);

    /** @brief Count newline-separated lines in a file */
    uint32_t countLines(const char* path);

    // ---- filesystem --------------------------------------------------------

    /** @brief True if the path exists (file or directory) */
    bool exists(const char* path);

    /** @brief Delete a file. False if it was missing or the card is unmounted */
    bool remove(const char* path);

    /** @brief Rename or move a file */
    bool rename(const char* from, const char* to);

    /** @brief Size of a file in bytes, 0 if missing */
    uint32_t fileSize(const char* path);

    /** @brief Create a directory (parents are not created) */
    bool mkdir(const char* path);

    /** @brief Remove an empty directory */
    bool rmdir(const char* path);

    /**
     * @brief List a directory into caller-owned arrays
     * @param path       Directory to list, e.g. "/" or "/logs"
     * @param names      Receives entry names; pass nullptr to count only
     * @param sizes      Receives sizes in bytes, -1 for a directory; may be nullptr
     * @param maxEntries Capacity of the arrays
     * @return Number of entries written
     */
    int listDir(const char* path, String* names, int32_t* sizes, int maxEntries);

    /**
     * @brief Like listDir(), plus a folder flag per entry.
     * isDir[i] is true for folders (their size is -1). Names never end in "/".
     */
    int listDir(const char* path, String* names, int32_t* sizes, bool* isDir, int maxEntries);

    /** @brief Join a folder and a name into out: pathJoin("/logs", "a.csv") -> "/logs/a.csv". */
    static void pathJoin(const char* base, const char* name, char* out, size_t outSize);

    /** @brief Go up one folder in place: "/logs/2024" -> "/logs", "/logs" -> "/". */
    static void pathUp(char* path);

    /**
     * @brief List a directory as a JSON array, ready to post to an app
     *
     * Example: [{"name":"log.csv","size":8214},{"name":"img","dir":true}]
     */
    String listDirJson(const char* path, int maxEntries = 32);

    // ---- search ------------------------------------------------------------

    /**
     * @brief Glob match against a filename — `*` and `?`, case-insensitive
     *
     * Case-insensitive because FAT filenames are. Matches a bare name, not a
     * path: `*` does not stop at a `/` because it never sees one.
     *
     *   matchGlob("*.csv",   "log.csv")   -> true
     *   matchGlob("log_??",  "log_07")    -> true
     *   matchGlob("*.wav",   "song.WAV")  -> true
     */
    static bool matchGlob(const char* pattern, const char* name);

    /**
     * @brief Called once per match. Return false to stop the search early.
     * @param path Full path of the matching file
     * @param size File size in bytes
     * @param ctx  The pointer handed to find()
     */
    typedef bool (*FindCallback)(const char* path, uint32_t size, void* ctx);

    /**
     * @brief Search the card for files whose name matches a glob
     * @param root       Directory to search from, e.g. "/" or "/logs"
     * @param pattern    Glob matched against each filename, e.g. "*.csv"
     * @param cb         Called for each match; return false to stop. It runs
     *                   with the card lock held (recursive, so calling back
     *                   into this driver is safe) and with two of the mount's
     *                   five file handles already in use. Keep it short —
     *                   filtering by content is better done afterwards, over
     *                   the collected paths, than from inside the walk.
     * @param ctx        Passed through to the callback
     * @param maxResults Stop after this many matches
     * @param maxDepth   Directory levels below root, 0 = root only
     * @return Number of matches reported
     *
     * Breadth-first, holding one directory handle at a time — a card is
     * mounted with room for only 5 open files, so a recursive descent would
     * run out of handles past five levels deep.
     *
     * The card lock is released between directories and the task yields, so a
     * long search does not freeze the logger or starve other tasks. It does
     * occupy the CALLING task for its whole duration: if you search a large
     * card from a task that feeds the watchdog, the search feeds it for you.
     *
     * Bounded on three axes — maxResults, maxDepth, and a directory budget
     * (setSearchBudget(), 256 by default). Hitting any of them ends the search
     * early and sets searchTruncated().
     */
    int find(const char* root, const char* pattern, FindCallback cb,
             void* ctx = nullptr, int maxResults = 32, int maxDepth = 8);

    /**
     * @brief Search, collecting matches into caller-owned arrays
     * @param paths      Receives full paths; may be nullptr to count only
     * @param sizes      Receives sizes in bytes; may be nullptr
     * @return Number of matches written
     */
    int find(const char* root, const char* pattern, String* paths, int32_t* sizes,
             int maxResults, int maxDepth = 8);

    /**
     * @brief Search, returning matches as a JSON array ready to post to an app
     *
     * Example: [{"path":"/logs/a.csv","size":8214}]
     */
    String findJson(const char* root, const char* pattern,
                    int maxResults = 16, int maxDepth = 8);

    /**
     * @brief True if the file contains this byte sequence
     *
     * Streams the file through a small window rather than loading it, so it
     * works on files far larger than RAM, and matches across chunk boundaries.
     * Binary-safe: a NUL byte in the file does not end the search.
     * Case-sensitive, unlike matchGlob(). Needle limited to 128 bytes.
     */
    bool fileContains(const char* path, const char* needle);

    /**
     * @brief Collect lines of a text file containing a substring
     * @param lines    Receives matching lines, terminators stripped
     * @param maxLines Capacity of the array
     * @return Number of lines written
     *
     * Reads the whole file line by line — bounded by the file, not by
     * maxLines, which caps only what is kept.
     */
    int grepFile(const char* path, const char* needle, String* lines, int maxLines);

    /** @brief Cap on directories one search will open. Default 256. */
    void setSearchBudget(int maxDirs);

    /**
     * @brief True if the last search stopped on a limit rather than finishing
     *
     * Means there may be more matches than were reported — raise maxResults,
     * maxDepth, or the search budget, or narrow the pattern.
     */
    bool searchTruncated() const { return _searchTruncated; }

    // ---- buffered logging --------------------------------------------------

    /**
     * @brief Start the background writer task
     * @param path            File lines are appended to
     * @param queueDepth      Lines buffered before logLine() starts dropping
     * @param flushIntervalMs How often the task drains the queue to the card
     * @return true if the task started
     *
     * This is the pattern the module doc asks for: storage gets its own task,
     * so a 40 ms card write never lands in the middle of your control loop.
     */
    bool beginLogger(const char* path, size_t queueDepth = 32,
                     uint32_t flushIntervalMs = 2000);

    /**
     * @brief Queue a line for the background writer — never blocks
     * @return false if the queue was full (the line is dropped and counted)
     *
     * Lines longer than LOG_LINE_MAX are truncated. Returns false if
     * beginLogger() was not called.
     */
    bool logLine(const char* line);
    bool logLine(const String& line);

    /** @brief printf-style logLine() */
    bool logPrintf(const char* fmt, ...);

    /** @brief Write every queued line to the card now. Blocks until done. */
    bool flushLog();

    /** @brief Lines dropped because the queue was full — should stay 0 */
    uint32_t droppedLines() const { return _droppedLines; }

    /** @brief Lines successfully written to the card by the logger */
    uint32_t writtenLines() const { return _writtenLines; }

    /** @brief Stop the background writer after flushing what is queued */
    void endLogger();

    // ---- internal ----------------------------------------------------------
    void _loggerTaskLoop();   ///< task entry point, not for callers

private:
    int      _csPin, _sclkPin, _mosiPin, _misoPin;
    uint8_t  _spiHost;
    uint32_t _frequency;
    bool     _mounted;
    bool     _busStarted;
    bool     _pinsReversed = false;

    SPIClass*         _spi;
    bool              _hostClaimed = false;  // hardware host taken from atech_spi_hosts
    SemaphoreHandle_t _mutex;      ///< serialises card access across tasks

    // logger
    TaskHandle_t  _loggerTask;
    QueueHandle_t _logQueue;
    char          _logPath[64];
    uint32_t      _flushIntervalMs;
    volatile bool _loggerRunning;   ///< set false to ask the task to stop
    volatile bool _loggerStopped;   ///< set true by the task once it has exited
    volatile uint32_t _droppedLines;
    volatile uint32_t _writtenLines;

    int  _searchDirBudget;
    bool _searchTruncated;

    bool _lock(uint32_t timeoutMs = 5000);      // also closes the read cache
    bool _lockRead(uint32_t timeoutMs = 5000);  // keeps it (readBytes only)
    void _unlock();
    void _closeReadCache();

    // readBytes() keeps its file open between calls, so sequential reads (a
    // JPEG being decoded chunk by chunk) do not reopen it every time. Any other
    // card operation closes it first, via _lock().
    File   _readFile;
    String _readPath;
    bool _tryMount(uint32_t frequencyHz);
    bool _mountAtAnySpeed(uint32_t frequencyHz);   ///< steps 20/10/4/1 MHz
    void _swapPortPairs();                         ///< reverse which port is which
    bool _appendRaw(const char* path, const uint8_t* data, size_t len);
    int  _drainQueue();          ///< writes queued lines, returns count written

    // The ESP32 Arduino core exposes a single global `SD` object, so exactly
    // one card can be mounted per board. A second instance refuses to mount
    // rather than silently stealing the first one's filesystem.
    static MicroSDCard* _owner;
};

#endif // MICRO_SD_CARD_MODULE_H
