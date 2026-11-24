/**
 * @file scd40.h
 * @brief Sensirion SCD40 NDIR CO2, Temperature & Humidity Sensor for Athera
 *
 * NDIR (non-dispersive infrared) CO2 sensor that also reports temperature and
 * humidity as calibration byproducts. Uses a background FreeRTOS task that
 * polls the sensor at its native 5 s measurement cadence and caches the most
 * recent reading — public getters return cached values instantly.
 *
 * Specifications:
 * - CO2: 400-2000 ppm typical range (sensor up to 5000 ppm, accuracy degrades)
 * - Temperature: -10 to +60°C (operating)
 * - Humidity: 0-100% RH
 * - Interface: I2C (100 kHz max — slower than most I2C devices)
 * - Address: 0x62 (fixed)
 * - Measurement cycle: 5 s in periodic mode
 *
 * Athera Connector:
 * - Line A: SDA
 * - Line B: SCL
 */

#ifndef SCD40_MODULE_H
#define SCD40_MODULE_H

#include <i2c_interface.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

class SCD40 {
public:
    static constexpr uint8_t ADDR_DEFAULT = 0x62;

    /**
     * @brief Construct SCD40 sensor
     * @param i2c Pointer to I2C interface
     * @param address I2C address (default 0x62 — the SCD40 has no alternate)
     */
    SCD40(I2CInterface* i2c, uint8_t address = ADDR_DEFAULT);

    /**
     * @brief Initialize sensor, start periodic measurement, launch background task
     * @return true on success
     */
    bool begin();

    /** @brief Read cached CO2 concentration in ppm (0 until first measurement) */
    uint16_t readCO2();

    /** @brief Read cached temperature in Celsius */
    float readTemperature();

    /** @brief Read cached relative humidity in %RH */
    float readHumidity();

    /** @brief True once the first valid measurement has been cached */
    bool isReady();

    /** @brief True if the sensor ACKs at its I2C address */
    bool isConnected();

    // Background task entrypoint (public for static trampoline; do not call directly)
    void _measureTaskLoop();

private:
    I2CInterface* _i2c;
    uint8_t _address;
    TaskHandle_t _measureTask;

    volatile uint16_t _co2_ppm;
    volatile float _temperature_c;
    volatile float _humidity_pct;
    volatile bool _dataReady;

    // Low-level helpers
    bool _sendCommand(uint16_t cmd);
    bool _readWords(uint16_t cmd, uint16_t* words, uint8_t wordCount);
    bool _isDataReady();
    bool _readMeasurement();

    static uint8_t _crc8(const uint8_t* data, uint8_t len);
};

#endif // SCD40_MODULE_H
