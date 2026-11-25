/**
 * @file st7789_tft.h
 * @brief ST7789 320x240 TFT Color Display (Big Screen V1.1) for Atech
 *
 * Color TFT display using the Adafruit ST7789 library over SPI. Same API as the
 * SDK's ST7735_TFT, so an app written for the small screen ports over by
 * changing the class name and the layout sizes.
 *
 * Specifications:
 * - Panel: HS20HS072RX, 2.0" IPS, ST7789 controller
 * - Resolution: 320x240 pixels (landscape)
 * - Color: RGB565 (16-bit, 65K colors)
 * - Interface: SPI (40MHz)
 *
 * Atech Connector (double module):
 * - Port 1 (H1) Line A: DC (data/command, the panel's RS pin)
 * - Port 1 (H1) Line B: CS (chip select)
 * - Port 2 (H2) Line A: MOSI (SPI data)
 * - Port 2 (H2) Line B: SCLK (SPI clock)
 *
 * The panel's RST pin is tied high on the module (R2 or a bridge), so the driver
 * resets it with the software-reset command instead of a pin. The backlight is
 * set by solder jumpers and is always on; there is no brightness control.
 *
 * begin() shows the Atech logo, which stays up until the app's first display()
 * (or first direct-mode draw) replaces it.
 */

#ifndef ST7789_TFT_MODULE_H
#define ST7789_TFT_MODULE_H

#include <Arduino.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>

// Panel quirks, settled on the V1.1 module on hardware (2026-09-22). Override from build_flags
// only for a different panel batch.
#ifndef ST7789_TFT_BGR
#define ST7789_TFT_BGR 0        // 1 = panel wants BGR order (red and blue swapped)
#endif
#ifndef ST7789_TFT_INVERT
#define ST7789_TFT_INVERT 1     // 1 = IPS panel needs colour inversion (usual for ST7789)
#endif

class ST7789_TFT {
public:
    // Color constants (RGB565)
    static constexpr uint16_t COLOR_BLACK   = 0x0000;
    static constexpr uint16_t COLOR_WHITE   = 0xFFFF;
    static constexpr uint16_t COLOR_RED     = 0xF800;
    static constexpr uint16_t COLOR_GREEN   = 0x07E0;
    static constexpr uint16_t COLOR_BLUE    = 0x001F;
    static constexpr uint16_t COLOR_CYAN    = 0x07FF;
    static constexpr uint16_t COLOR_MAGENTA = 0xF81F;
    static constexpr uint16_t COLOR_YELLOW  = 0xFFE0;
    static constexpr uint16_t COLOR_ORANGE  = 0xFD20;

    /**
     * @brief Construct ST7789 display
     * @param sclkPin SPI clock pin (Line B of secondary port)
     * @param csPin Chip select pin (Line B of primary port)
     * @param mosiPin SPI data pin (Line A of secondary port)
     * @param dcPin Data/command pin (Line A of primary port)
     */
    ST7789_TFT(int sclkPin, int csPin, int mosiPin, int dcPin);

    /** @brief Initialize display (320x240, landscape, 40MHz SPI) */
    void begin();

    /** @brief Clear display to black */
    void clear();

    /** @brief Fill entire screen with a color */
    void fillScreen(uint16_t color);

    /** @brief Draw a single pixel */
    void drawPixel(int16_t x, int16_t y, uint16_t color);

    /** @brief Draw a line between two points */
    void drawLine(int16_t x0, int16_t y0, int16_t x1, int16_t y1, uint16_t color);

    /** @brief Draw a rectangle outline */
    void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);

    /** @brief Draw a filled rectangle */
    void fillRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);

    /** @brief Draw a circle outline */
    void drawCircle(int16_t x, int16_t y, int16_t r, uint16_t color);

    /** @brief Draw a filled circle */
    void fillCircle(int16_t x, int16_t y, int16_t r, uint16_t color);

    /** @brief Draw a rounded-rectangle outline (radius is corner radius in pixels) */
    void drawRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t radius, uint16_t color);

    /** @brief Draw a filled rounded rectangle */
    void fillRoundRect(int16_t x, int16_t y, int16_t w, int16_t h, int16_t radius, uint16_t color);

    /** @brief Draw a triangle outline through three points */
    void drawTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color);

    /** @brief Draw a filled triangle through three points */
    void fillTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color);

    /**
     * @brief Draw an ellipse outline
     * @param x Center X
     * @param y Center Y
     * @param rx Horizontal radius (pixels)
     * @param ry Vertical radius (pixels)
     */
    void drawEllipse(int16_t x, int16_t y, int16_t rx, int16_t ry, uint16_t color);

    /** @brief Draw a filled ellipse (see drawEllipse for parameters) */
    void fillEllipse(int16_t x, int16_t y, int16_t rx, int16_t ry, uint16_t color);

    /**
     * @brief Enable/disable direct drawing mode
     * @param direct true = draw directly to display (fast partial updates, for games/animations),
     *               false = draw to off-screen canvas, call display() to flush (flicker-free)
     *
     * Canvas mode needs a 150 KB framebuffer. If begin() cannot allocate it, the
     * display starts in direct mode and stays there; isDirectMode() tells you.
     */
    void setDirectMode(bool direct);

    /** @brief True when draws go straight to the panel (always true if the canvas did not fit) */
    bool isDirectMode() const { return _directMode; }

    /** @brief Print at current cursor position (accepts any type) */
    template<typename T>
    void print(T value) { _gfx()->print(value); }
    void print(float value, int decimals);
    void print(double value, int decimals);

    /** @brief Print with newline (accepts any type) */
    template<typename T>
    void println(T value) { _gfx()->println(value); }
    void println(float value, int decimals);
    void println(double value, int decimals);

    /**
     * @brief Display text at position with size and color (convenience method)
     * @param text Text to display
     * @param x X position
     * @param y Y position
     * @param size Text size multiplier (1-4)
     * @param color Text color (RGB565)
     */
    void displayText(const char* text, int16_t x, int16_t y, uint8_t size, uint16_t color);
    void displayText(const String& text, int16_t x, int16_t y, uint8_t size, uint16_t color);

    /** @brief Flush canvas buffer to display (call after drawing a frame) */
    void display();

    /** @brief Set text cursor position */
    void setCursor(int16_t x, int16_t y);

    /** @brief Set text color */
    void setTextColor(uint16_t color);

    /** @brief Set text color with background */
    void setTextColor(uint16_t color, uint16_t bg);

    /** @brief Set text size multiplier (1-4) */
    void setTextSize(uint8_t size);

    /**
     * @brief Set font for smooth text rendering
     * @param font Pointer to GFXfont (nullptr = default bitmap font)
     *
     * NOTE: With custom fonts, setTextSize(1) is the native size.
     *       Y coordinate is the text BASELINE (not top-left).
     */
    void setFont(const GFXfont* font);

    /**
     * @brief Set display rotation (0-3)
     *
     * 1 and 3 are landscape (320x240), 0 and 2 portrait (240x320). begin() sets 3,
     * upright on the board's right-hand column; 1 is upright on the left. In canvas mode
     * the framebuffer rotates with the panel.
     */
    void setRotation(uint8_t r);

    /** @brief Width in pixels of text in the current font and size (for layout and wrapping) */
    int16_t textWidth(const char* text);
    int16_t textWidth(const String& text) { return textWidth(text.c_str()); }

    /** @brief Line spacing for the current font and size, in pixels */
    int16_t lineHeight();

    /**
     * @brief Bounds of text drawn with the cursor at (0, 0), in the current font.
     * y1 is negative for smooth fonts (they draw above the baseline), 0 for the
     * built-in font. Top-align text at row top T with setCursor(x, T - y1).
     */
    void textBounds(const char* text, int16_t& x1, int16_t& y1, uint16_t& w, uint16_t& h);

    /** @brief True when no hardware SPI host was free and the screen bit-bangs (slower pushes) */
    bool isSoftwareSpi() const { return _softSpi; }

    /** @brief Get display width in pixels */
    int16_t width();

    /** @brief Get display height in pixels */
    int16_t height();

private:
    int _sclkPin, _csPin, _mosiPin, _dcPin;
    Adafruit_ST7789* _tft;
    GFXcanvas16* _canvas;       // Off-screen framebuffer for flicker-free drawing
    bool _directMode;           // true = draw to TFT directly, false = draw to canvas
    bool _splashShowing;        // logo still on the panel: no display() or direct draw yet
    bool _softSpi;              // no hardware SPI host: canvas pushes go through atech_soft_spi.h

    // SPI: atech::claimDisplaySpiHost() (atech_spi_hosts.h) gives this
    // screen a hardware host if one is free after the hosts reserved for the
    // microSD card and camera, which need them; otherwise it bit-bangs (same
    // drawing, slower full-frame pushes).

    /** @brief Returns the active drawing target (canvas or TFT) */
    // A direct-mode draw lands on the panel, so the splash is no longer what's showing.
    Adafruit_GFX* _gfx() {
        if (_directMode) {
            _splashShowing = false;
            return _tft;
        }
        return _canvas;
    }

    void _initDisplay();
    void _applyMadctl(uint8_t r);
    void _drawSplash();
    void _pushCanvas();
};

#endif // ST7789_TFT_MODULE_H
