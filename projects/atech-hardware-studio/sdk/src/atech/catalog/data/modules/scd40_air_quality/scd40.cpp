/**
 * @file scd40.cpp
 * @brief Sensirion SCD40 NDIR CO2/Temp/Humidity Sensor implementation for Athera
 *
 * Talks directly to the sensor via the Athera I2CInterface — no external
 * library. The protocol is simple 16-bit commands; multi-byte payloads are
 * protected by Sensirion's CRC-8 (poly 0x31, init 0xFF).
 *
 * Background FreeRTOS task polls getDataReady at 1 Hz; the sensor emits a
 * fresh measurement every 5 s in periodic mode.
 */

#include "scd40.h"
#include <Arduino.h>

// SCD40 commands (datasheet §3.5–3.9)
static constexpr uint16_t CMD_START_PERIODIC      = 0x21B1;
static constexpr uint16_t CMD_READ_MEASUREMENT    = 0xEC05;
static constexpr uint16_t CMD_STOP_PERIODIC       = 0x3F86;
static constexpr uint16_t CMD_GET_DATA_READY      = 0xE4B8;
static constexpr uint16_t CMD_REINIT              = 0x3646;

static constexpr TickType_t MEASUREMENT_POLL_MS = 1000;  // poll data-ready at 1 Hz
static constexpr TickType_t POST_STOP_DELAY_MS  =  500;  // datasheet: 500 ms after stop_periodic

static void measureTaskTrampoline(void* param) {
    ((SCD40*)param)->_measureTaskLoop();
}

SCD40::SCD40(I2CInterface* i2c, uint8_t address)
    : _i2c(i2c)
    , _address(address)
    , _measureTask(nullptr)
    , _co2_ppm(0)
    , _temperature_c(0.0f)
    , _humidity_pct(0.0f)
    , _dataReady(false)
{
}

bool SCD40::begin() {
    // SCD40 may already be in periodic mode from a previous boot; stop and
    // wait the mandatory 500 ms before issuing any other command. Ignore the
    // ACK status — a fresh sensor will NACK this and that's fine.
    _sendCommand(CMD_STOP_PERIODIC);
    vTaskDelay(pdMS_TO_TICKS(POST_STOP_DELAY_MS));

    if (!isConnected()) {
        Serial.println("SCD40 not responding!");
        return false;
    }

    if (!_sendCommand(CMD_START_PERIODIC)) {
        Serial.println("SCD40 start_periodic_measurement failed!");
        return false;
    }

    xTaskCreatePinnedToCore(
        measureTaskTrampoline,
        "SCD40",
        2048,
        this,
        1,
        &_measureTask,
        0
    );

    Serial.println("SCD40 initialized (first reading available in ~5s)");
    return true;
}

uint16_t SCD40::readCO2()         { return _co2_ppm; }
float    SCD40::readTemperature() { return _temperature_c; }
float    SCD40::readHumidity()    { return _humidity_pct; }
bool     SCD40::isReady()         { return _dataReady; }

bool SCD40::isConnected() {
    _i2c->beginTransmission(_address);
    return _i2c->endTransmission() == 0;
}

// ========== Background task ==========

void SCD40::_measureTaskLoop() {
    while (true) {
        if (_isDataReady()) {
            if (_readMeasurement()) {
                _dataReady = true;
            }
        }
        vTaskDelay(pdMS_TO_TICKS(MEASUREMENT_POLL_MS));
    }
}

// ========== Low-level I2C ==========

bool SCD40::_sendCommand(uint16_t cmd) {
    _i2c->beginTransmission(_address);
    _i2c->write((uint8_t)(cmd >> 8));
    _i2c->write((uint8_t)(cmd & 0xFF));
    return _i2c->endTransmission() == 0;
}

bool SCD40::_readWords(uint16_t cmd, uint16_t* words, uint8_t wordCount) {
    if (!_sendCommand(cmd)) return false;
    // Sensirion sensors need ~1 ms between command and read (longer for some
    // commands — the periodic data-ready check tolerates 1 ms fine).
    vTaskDelay(pdMS_TO_TICKS(2));

    const uint8_t byteCount = wordCount * 3;  // each word: 2 data + 1 CRC
    if (_i2c->requestFrom(_address, byteCount) != byteCount) return false;

    for (uint8_t i = 0; i < wordCount; i++) {
        uint8_t buf[3] = { (uint8_t)_i2c->read(), (uint8_t)_i2c->read(), (uint8_t)_i2c->read() };
        if (_crc8(buf, 2) != buf[2]) return false;  // CRC mismatch — bus glitch or wrong device
        words[i] = ((uint16_t)buf[0] << 8) | buf[1];
    }
    return true;
}

bool SCD40::_isDataReady() {
    uint16_t status;
    if (!_readWords(CMD_GET_DATA_READY, &status, 1)) return false;
    // Datasheet: low 11 bits clear == not ready.
    return (status & 0x07FF) != 0;
}

bool SCD40::_readMeasurement() {
    uint16_t w[3];
    if (!_readWords(CMD_READ_MEASUREMENT, w, 3)) return false;

    _co2_ppm       = w[0];
    _temperature_c = -45.0f + 175.0f * (float)w[1] / 65535.0f;
    _humidity_pct  = 100.0f * (float)w[2] / 65535.0f;
    return true;
}

// Sensirion CRC-8: polynomial 0x31, initial 0xFF, MSB first, no final XOR.
uint8_t SCD40::_crc8(const uint8_t* data, uint8_t len) {
    uint8_t crc = 0xFF;
    for (uint8_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (uint8_t b = 0; b < 8; b++) {
            crc = (crc & 0x80) ? (uint8_t)((crc << 1) ^ 0x31) : (uint8_t)(crc << 1);
        }
    }
    return crc;
}
