/**
 * Helpers for various tasks
 *
 */

// Dependencies
const crypto = require("crypto");
const config = require("./config");

// Container for all the helpers
const helpers = {};

// Create a SHA256 hash
helpers.hash = (str) => {
  if (typeof str == "string" && str.length > 0) {
    const hash = crypto
      .createHmac("sha256", config.hashingSecret)
      .update(str)
      .digest("hex");
    return hash;
  } else return false;
};

// Parse a JSON string to an object
helpers.parseJsonToObject = (str) => {
  try {
    const obj = JSON.parse(str);
    return obj;
  } catch (error) {
    return {};
  }
};

// Crate a string of random alpanumeric characheter of a given length
helpers.createRandomString = (strLength) => {
  strLength - typeof strLength == "number" && strLength.length > 0
    ? strLength
    : false;

  if (strLength) {
    // Define all possible characters that could go into a string
    const possibleCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    // Start string
    let str = "";
    for (i = 1; i <= strLength; i++) {
      // Get a random character from the possibleCharacters string
      const randomCharacter = possibleCharacters.charAt(
        Math.floor(Math.random() * possibleCharacters.length)
      );

      // Append this character to the final string
      str += randomCharacter;
    }

    return str;
  } else return false;
};

// Export helpers module
module.exports = helpers;
