var util = require('util');

function ValidationError(msg) {
    Error.call(this);
    this.name = 'ValidationError';
    this.status = 400;
    this.message = msg;
    Error.captureStackTrace(this, this.constructor);
}

util.inherits(ValidationError, Error);

exports.ValidationError = ValidationError;
