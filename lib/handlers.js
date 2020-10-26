/**
 * Request handlers
 *
 */

// Dependencies
const config = require("./config");
const helpers = require("./helpers");
const _data = require("./data");

// Container for all the handlers
const handlers = {};

// Ping handler
handlers.ping = (data, callback) => {
  callback(200);
};

// Users handler
handlers.users = (data, callback) => {
  const acceptableMethods = ["POST", "GET", "PUT", "DELETE"];

  // Check for acceptable methods
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else callback(405);
};

// Container for the users submethods
handlers._users = {};

// Users - POST
// Required: firstname, lastname, email address, password, street address
// Optional: none
handlers._users.POST = (data, callback) => {
  // Check that all required fields are filled out
  const firstName = handlers._users.verifyName(data.payload.firstName);
  const lastName = handlers._users.verifyName(data.payload.lastName);
  const email = handlers._users.verifyEmail(data.payload.email);
  const password = handlers._users.verifyPassword(data.payload.password);
  const streetAddress = handlers._users.verifyStreetAddress(
    data.payload.streetAddress
  );

  if (firstName && lastName && email && password && streetAddress) {
    // Make sure that the user doesn't already exist
    _data.read("users", email, (err, data) => {
      if (err) {
        // Hash the password
        const hashedPassword = helpers.hash(password);
        if (hashedPassword) {
          // Create the user object
          const userObject = {
            firstName: firstName,
            lastName: lastName,
            email: email,
            hashedPassword: hashedPassword,
            streetAddress: streetAddress,
          };
          // Store the user
          _data.create("users", email, userObject, (err) => {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { Error: "Could not create the new user." });
            }
          });
        } else callback(500, { Error: "Could not hash the user's password." });
      } else
        callback(400, {
          Error: "A user with that email address already exists.",
        });
    });
  } else callback(400, { Error: "Missing required fields." });
};

// Users - GET
// Required: email
// Optional: none
handlers._users.GET = (data, callback) => {
  // Check that the email provided is valid
  const email = handlers._users.verifyEmail(data.queryStringObject.email);

  if (email) {
    // Get the token from the headers
    const token =
      typeof data.headers.token == "string" ? data.headers.token : false;

    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, (tokenIsValid) => {
      if (tokenIsValid) {
        // Lookup the user
        _data.read("users", email, (err, data) => {
          if (!err && data) {
            // Remove hashed password from the user object before returning it to the requester
            delete data.hashedPassword;
            callback(200, data);
          } else callback(404);
        });
      } else
        callback(403, {
          Error: "Missing required token in header, or token is invalid.",
        });
    });
  } else callback(400, { Error: "Missing required field." });
};

// Users - PUT
// Required: email
// Optional: firstName, lastName, password, streetAddress (at least one must be specified)
handlers._users.PUT = (data, callback) => {
  // Check for the required field
  const email = handlers._users.verifyEmail(data.payload.email);

  // Check for the optional fields
  const firstName = handlers._users.verifyName(data.payload.firstName);
  const lastName = handlers._users.verifyName(data.payload.lastName);
  const password = handlers._users.verifyPassword(data.payload.password);
  const streetAddress = handlers._users.verifyStreetAddress(
    data.payload.streetAddress
  );

  // Error if email is invalid
  if (email) {
    // Error if nothing is sent to update
    if (firstName || lastName || password || streetAddress) {
      // Get the token from the headers
      const token =
        typeof data.headers.token == "string" ? data.headers.token : false;

      // Verify that the given token is valid for the email
      handlers._tokens.verifyToken(token, email, (tokenIsValid) => {
        if (tokenIsValid) {
          // Lookup the user
          _data.read("users", email, (err, userData) => {
            if (!err && userData) {
              // Update the fields as necessary
              if (firstName) userData.firstName = firstName;
              if (lastName) userData.lastName = lastName;
              if (password) userData.hashedPassword = helpers.hash(password);
              if (streetAddress) userData.streetAddress = streetAddress;

              // Store the new updates
              _data.update("users", email, userData, (err) => {
                if (!err) {
                  callback(200);
                } else {
                  console.log(err);
                  callback(500, { Error: "Could not update the user" });
                }
              });
            } else
              callback(400, { Error: "The specified user does not exist." });
          });
        } else
          callback(403, {
            Error: "Missing required token in header, or token is invalid.",
          });
      });
    } else callback(400, { Error: "Missing fields to update." });
  } else callback(400, { Error: "Missing required field." });
};

// Users - DELETE
// Required: Email
handlers._users.DELETE = (data, callback) => {
  // Check that the email address is valid
  const emailIsValid = handlers._users.verifyEmail(
    data.queryStringObject.email
  );

  if (emailIsValid) {
    // Get the token from the headers
    const token =
      typeof data.headers.token == "string" ? data.headers.token : false;

    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, emailIsValid, (tokenIsValid) => {
      if (tokenIsValid) {
        // Lookup the user
        _data.read("users", emailIsValid, (err, userData) => {
          if (!err && userData) {
            // Delete user
            _data.delete("users", emailIsValid, (err) => {
              if (!err) {
                // Get cart data associated with the user
                const userCart =
                  typeof userData.cartItems == "object" &&
                  userData.cartItems instanceof Array
                    ? userData.cartItems
                    : [];

                // Get the number of cart items in the cart data
                const cartDataToDelete = userCart.length;

                if (cartDataToDelete > 0) {
                  let cartsDeleted = 0;
                  let deletionErrors = false;

                  // Loop through the cart data
                  userCart.forEach((cartId) => {
                    // Delete the cart item
                    _data.delete("cart", cartId, (err) => {
                      if (err) {
                        deletionErrors = true;
                      }
                      cartsDeleted++;

                      if (cartsDeleted == cartDataToDelete) {
                        if (!deletionErrors) {
                          callback(200);
                        } else
                          callback(500, {
                            Error:
                              "Errors encountered while attempting to delete the user's cart data. All cart data may not have been deleted.",
                          });
                      }
                    });
                  });
                } else callback(200);
              } else
                callback(500, { Error: "Could not delete specified user." });
            });
          } else callback(400, { Error: "Could not find the specified user." });
        });
      } else {
        callback(403, {
          Error: "Missing required token in header, or token is invalid.",
        });
      }
    });
  } else callback(400, { Error: "Missing required field." });
};

// Tokens handler
handlers.tokens = (data, callback) => {
  const acceptableMethods = ["POST", "GET", "PUT", "DELETE"];

  // Check for acceptable methods
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else callback(405);
};

// Container for all the tokens methods
handlers._tokens = {};

// Tokens - POST
// Required: email, password
// Optional: none
handlers._tokens.POST = (data, callback) => {
  const email = handlers._users.verifyEmail(data.payload.email);
  const password = handlers._users.verifyPassword(data.payload.password);

  if (email && password) {
    // Lookup the user matching the email address
    _data.read("users", email, (err, userData) => {
      if (!err && userData) {
        // Hash the sent password and compare it to the password stored in the user object
        const hashedPassword = helpers.hash(password);

        if (hashedPassword == userData.hashedPassword) {
          // If valid, create a new token with a random name. Set expiration date 1 hour in the future
          const tokenId = helpers.createRandomString(20);
          const expires = Date.now() + 1000 * 60 * 60;
          const tokenObject = {
            email: email,
            id: tokenId,
            expires: expires,
          };

          // Store the token
          _data.create("tokens", tokenId, tokenObject, (err) => {
            if (!err) {
              callback(200, tokenObject);
            } else callback(500, { Error: "Could not create new token." });
          });
        } else
          callback(400, {
            Error: "Password did not match the specified user's password.",
          });
      } else callback(400, { Error: "Could not find the specified user." });
    });
  } else callback(400, { Error: "Missing required field(s)." });
};

// Tokens - GET
// Required: id
// Optional: none
handlers._tokens.GET = (data, callback) => {
  // Check that the id is valid
  const id =
    typeof data.queryStringObject.id == "string" &&
    data.queryStringObject.id.trim().length == 20
      ? data.queryStringObject.id.trim()
      : false;

  if (id) {
    // Lookup token
    _data.read("tokens", id, (err, tokenData) => {
      if (!err && tokenData) {
        callback(200, tokenData);
      } else callback(404);
    });
  } else callback(400, { Error: "Missing required field." });
};

// Tokens - PUT
// Required: id, extend
// Optional: none
handlers._tokens.PUT = (data, callback) => {
  const id =
    typeof data.payload.id == "string" && data.payload.id.trim().length == 20
      ? data.payload.id.trim()
      : false;

  const extend =
    typeof data.payload.extend == "boolean" && data.payload.extend == true
      ? true
      : false;

  if (id && extend) {
    // Look up the token
    _data.read("tokens", id, (err, tokenData) => {
      if (!err && tokenData) {
        // Check to make sure the token isn't already expired
        if (tokenData.expires > Date.now()) {
          // Set the expiration an hour from now
          tokenData.expires = Date.now() + 1000 * 60 * 60;

          // Store the new updates
          _data.update("tokens", id, tokenData, (err) => {
            if (!err) {
              callback(200);
            } else
              callback(500, {
                Error: "Could not update the token's expiration.",
              });
          });
        } else
          callback(400, {
            Error: "The token has already expired and cannot be extended.",
          });
      } else callback(400, { Error: "Specified token does not exist." });
    });
  } else
    callback(400, { Error: "Missing required fields or fields are invalid." });
};

// Tokens - DELETE
// Required: id
// Optional: none
handlers._tokens.DELETE = (data, callback) => {
  // Check that the id is valid
  const id =
    typeof data.queryStringObject.id == "string" &&
    data.queryStringObject.id.trim().length == 20
      ? data.queryStringObject.id.trim()
      : false;

  if (id) {
    // Lookup the token
    _data.read("tokens", id, (err, tokenData) => {
      if (!err && tokenData) {
        // Delete token
        _data.delete("tokens", id, (err) => {
          if (!err) {
            callback(200);
          } else callback(500, { Error: "Could not delete specified token." });
        });
      } else callback(400, { Error: "Could not find the specified token." });
    });
  } else callback(400, { Error: "Missing required field." });
};

// Pizza menu handler
handlers.pizzaMenu = (data, callback) => {
  const acceptableMethods = ["POST", "GET", "PUT", "DELETE"];

  // Check for acceptable methods
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._pizzaMenu[data.method](data, callback);
  } else callback(405);
};

// Container for all the pizza menu methods
handlers._pizzaMenu = {};

// Pizza menu - POST : For future development
// Required: none at the moment
// Optional: none
handlers._pizzaMenu.POST = (data, callback) => {
  callback(503, { Error: "Service unavailable." });
};

// Pizza menu - GET : For future development
// Required: none at the moment
// Optional: none
handlers._pizzaMenu.GET = (data, callback) => {
  // Get the token from the headers
  const tokenId =
    typeof data.headers.token == "string" ? data.headers.token : false;

  // Verify that the token exists
  _data.read("tokens", tokenId, (err, tokenData) => {
    if (!err && tokenData) {
      // Check that the token has not expired
      if (tokenData.expires > Date.now()) {
        // Look up pizza menu
        _data.read("pizzaMenu", "menu", (err, menuData) => {
          if (!err && menuData) {
            callback(200, menuData.items[2]);
          } else callback(404);
        });
      } else callback(403, { Error: "Invalid token." });
    } else callback(403, { Error: "Missing required token in header." });
  });
};

// Pizza menu - PUT : For future development
// Required: none at the moment
// Optional: none
handlers._pizzaMenu.PUT = (data, callback) => {
  callback(503, { Error: "Service unavailable." });
};

// Pizza menu - DELETE : For future development
// Required: none at the moment
// Optional: none
handlers._pizzaMenu.DELETE = (data, callback) => {
  callback(503, { Error: "Service unavailable." });
};

// Shopping Cart
handlers.shoppingCart = (data, callback) => {
  const acceptableMethods = ["POST", "GET", "PUT", "DELETE"];

  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._shoppingCart[data.method](data, callback);
  } else callback(405);
};

// Container for all the shopping cart methods
handlers._shoppingCart = {};

// Shopping cart - POST
// Required data: email, itemId, quantity
handlers._shoppingCart.POST = (data, callback) => {
  // Validate inputs
  const email = handlers._users.verifyEmail(data.payload.email);
  const itemId =
    typeof data.payload.itemId == "number" && data.payload.itemId >= 0
      ? data.payload.itemId
      : false;
  const quantity =
    typeof data.payload.quantity == "number" && data.payload.quantity > 0
      ? data.payload.quantity
      : false;

  if (email && itemId && quantity) {
    // Make sure user exists
    _data.read("users", email, (err, userData) => {
      if (!err && userData) {
        // Get token from headers
        const token =
          typeof data.headers.token == "string" ? data.headers.token : false;

        // Verify if token is valid for specified email address
        handlers._tokens.verifyToken(token, email, (validToken) => {
          if (validToken) {
            const userCart =
              typeof userData.cartItems == "object" &&
              userData.cartItems instanceof Array
                ? userData.cartItems
                : [];

            // Verify that the user has less than the number of max cart items
            if (userCart.length < config.maxCartItems) {
              // Create random ID for the cart item
              const cartId = helpers.createRandomString(20);

              // Create a cart object and include user email
              const cartObject = {
                id: cartId,
                email: email,
                itemId: itemId,
                quantity: quantity,
              };

              // Save the cart object
              _data.create("cart", cartId, cartObject, (err) => {
                if (!err) {
                  // Add the cart ID to the user's object
                  userData.cartItems = userCart;
                  userData.cartItems.push(cartId);

                  // Save the new user data
                  _data.update("users", email, userData, (err) => {
                    if (!err) {
                      // Return data about the new cart item
                      callback(200, cartObject);
                    } else
                      callback(500, {
                        Error: "Could not update user with the new cart item.",
                      });
                  });
                } else callback(500, { Error: "Could not create new cart." });
              });
            } else
              callback(400, {
                Error: `Maximum number of cart items reached (${config.maxCartItems}). Checkout or delete them to add items.`,
              });
          } else
            callback(403, {
              Error: "Missing required token in header, or token is invalid.",
            });
        });
      } else callback(403);
    });
  } else callback(400, { Error: "Missing required field." });
};

// Shopping cart - GET
// Required data: cart ID
// Optional data: none
handlers._shoppingCart.GET = (data, callback) => {
  // Check that the cartId provided is valid
  const cartId =
    typeof data.queryStringObject.id == "string" &&
    data.queryStringObject.id.trim().length == 20
      ? data.queryStringObject.id.trim()
      : false;

  if (cartId) {
    // Look up the shopping cart item
    _data.read("cart", cartId, (err, cartData) => {
      if (!err && cartData) {
        // Get the token from the headers
        const token =
          typeof data.headers.token == "string" ? data.headers.token : false;

        // Verify that the given token is valid for the email
        handlers._tokens.verifyToken(token, cartData.email, (tokenIsValid) => {
          if (tokenIsValid) {
            // Return the cart data
            // Get the details from pizza menu
            _data.read("pizzaMenu", "menu", (err, menuData) => {
              if (!err && menuData) {
                const cartItem = JSON.parse(
                  JSON.stringify(menuData.items[cartData.itemId])
                );

                // Display user friendly data to user
                console.log(
                  `\nYOUR SHOPPING CART: ${cartData.email}\n\nItem:\t\t${
                    cartItem.name
                  }\nDescription:\t${cartItem.description}\nQuantity:\t${
                    cartData.quantity
                  }\nPrice:\t\t${+cartItem.price}\n\nTOTAL:\t\t${
                    +cartItem.price * cartData.quantity
                  }\n`
                );
                callback(200);
              } else callback(404);
            });
          } else callback(403);
        });
      } else callback(404);
    });
  } else callback(404);
};

// Shopping cart - PUT
// Required data: cartId, quantity
// Optional data: none. User can only edit the quantity of pizza ordered
handlers._shoppingCart.PUT = (data, callback) => {
  // Check required field
  const cartId =
    typeof data.payload.id == "string" && data.payload.id.trim().length == 20
      ? data.payload.id.trim()
      : false;

  const quantity =
    typeof data.payload.quantity == "number" && data.payload.quantity > 0
      ? data.payload.quantity
      : false;

  // Make sure cartId is valid
  if (cartId) {
    // Check for editable field
    if (quantity) {
      _data.read("cart", cartId, (err, cartData) => {
        if (!err && cartData) {
          // Get the token from the headers
          const token =
            typeof data.headers.token == "string" ? data.headers.token : false;

          // Verify that the given token is valid for the user
          handlers._tokens.verifyToken(
            token,
            cartData.email,
            (tokenIsValid) => {
              if (tokenIsValid) {
                // Update the shopping cart
                if (quantity == cartData.quantity) {
                  callback(202, { Info: "No changes made." });
                } else {
                  cartData.quantity = quantity;
                  // Store the updates
                  _data.update("cart", cartId, cartData, (err) => {
                    if (!err) {
                      callback(200);
                    } else
                      callback(500, { Error: "Could not update the cart." });
                  });
                }
              } else callback(403);
            }
          );
        } else callback(400, { Error: "Cart ID does not exist." });
      });
    } else callback(400, { Error: "Missing fields to update." });
  } else callback(400, { Error: "Missing required fields." });
};

// Shopping cart - DELETE
// Required data: id
// Optional data: none
handlers._shoppingCart.DELETE = (data, callback) => {
  // Check that the id is valid
  const id =
    typeof data.queryStringObject.id == "string" &&
    data.queryStringObject.id.trim().length == 20
      ? data.queryStringObject.id.trim()
      : false;

  if (id) {
    // Lookup the cart item
    _data.read("cart", id, (err, cartData) => {
      if (!err && cartData) {
        // Get the token from the headers
        const token =
          typeof data.headers.token == "string" ? data.headers.token : false;

        // Verify that the given token is valid for the user
        handlers._tokens.verifyToken(token, cartData.email, (tokenIsValid) => {
          if (tokenIsValid) {
            // Delete the cart data
            _data.delete("cart", id, (err) => {
              if (!err) {
                // Lookup the user
                _data.read("users", cartData.email, (err, userData) => {
                  if (!err && userData) {
                    // Get list of user's cart data
                    const userCart =
                      typeof userData.cartItems == "object" &&
                      userData.cartItems instanceof Array
                        ? userData.cartItems
                        : [];

                    // Get position of the cart data from the list of cart items
                    const checkCartPosition = userCart.indexOf(id);

                    if (checkCartPosition > -1) {
                      // Remove cart data from list
                      userCart.splice(checkCartPosition, 1);

                      // Resave the user's data
                      _data.update("users", cartData.email, userData, (err) => {
                        if (!err) {
                          callback(200);
                        } else
                          callback(500, {
                            Error: "Could not update the user.",
                          });
                      });
                    } else
                      callback(500, {
                        Error:
                          "Could not find the cart data on the user's object, so could not remove it.",
                      });
                  } else
                    callback(500, {
                      Error:
                        "Could not find the user who created the cart, so could not remove the cart data on the user object.",
                    });
                });
              } else
                callback(500, { Error: "Could not delete the cart data." });
            });
          } else {
            callback(403);
          }
        });
      } else callback(400, { Error: "The specified cart ID does not exist." });
    });
  } else callback(400, { Error: "Missing required field." });
};

// Checkout
handlers.checkOut = (data, callback) => {
  const acceptableMethods = ["POST", "GET", "PUT", "DELETE"];

  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checkOut[data.method](data, callback);
  } else callback(405);
};

// Container for all the chekout methods
handlers._checkOut = {};

// Checkout - POST
// Required data:
handlers._checkOut.POST = (data, callback) => {
  const stripe = curl https://api.stripe.com/v1/tokens \
  -u sk_test_51HYWe7Ik42QJb2r5NtpNNr1IozrIAw5i2jJNQbW6P5mUM2y3F6hhmTDHKDoFPta0rhR4afbfW5Ue1CPOSnpWAfj300z86R4dlU: \
  -d "card[number]"=4242424242424242 \
  -d "card[exp_month]"=10 \
  -d "card[exp_year]"=2021 \
  -d "card[cvc]"=314
};

/////////////// VERIFICATION UTILITY FUNCTIONS //////////////////

// Verify first and last name
handlers._users.verifyName = (name) => {
  const verifiedName =
    typeof name === "string" && name.trim().length > 0 ? name.trim() : false;
  return verifiedName;
};

// Verify validity of password
handlers._users.verifyPassword = (password) => {
  // Regex
  const lowerRegex = /[a-z]/g;
  const upperRegex = /[A-Z]/g;
  const specialCharacterRegex = /[!@#$%^&*(),.?":{}|<>]/g;

  // Password requirements:
  // must be a string
  // must have >= 8 chars
  // must be alphanumeric
  // must have mixture of uppercase and lowercase characters
  // must have at least one special character
  const verifiedPassword =
    typeof password == "string" &&
    password.trim().length > 8 &&
    lowerRegex.test(password) &&
    upperRegex.test(password) &&
    specialCharacterRegex.test(password)
      ? password.trim()
      : false;

  return verifiedPassword;
};

// Verify if a given email address is valid
handlers._users.verifyEmail = (emailAddress) => {
  // Regex for email verification
  const validEmailRegex = /^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;

  // Email should have format (a@b.c)
  const verifiedEmailAddress =
    typeof emailAddress == "string" &&
    emailAddress.trim().length > 0 &&
    validEmailRegex.test(emailAddress.trim())
      ? emailAddress.trim()
      : false;

  return verifiedEmailAddress;
};

// Verify if street address is valid
handlers._users.verifyStreetAddress = (streetAddress) => {
  const verifiedAddress =
    typeof streetAddress == "string" && streetAddress.trim().length > 0
      ? streetAddress.trim()
      : false;

  return verifiedAddress;
};

// Verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = (tokenId, email, callback) => {
  // Look up the token
  _data.read("tokens", tokenId, (err, tokenData) => {
    if (!err && tokenData) {
      // Check that the token is for the given user and has not expired
      if (tokenData.email == email && tokenData.expires > Date.now()) {
        callback(true);
      } else callback(false);
    } else callback(false);
  });
};

///////////////////////////////////////////////////////////////////////

// Ping handler
handlers.ping = (data, callback) => {
  callback(404);
};

// Not-found handler
handlers.notFound = (data, callback) => {
  callback(404);
};

// Export handlers module
module.exports = handlers;
