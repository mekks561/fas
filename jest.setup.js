global.crypto = {
    subtle: {
        digest: async function(algorithm, data) {
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256');
            hash.update(Buffer.from(data));
            return hash.digest().buffer;
        }
    },
    getRandomValues: function(array) {
        const crypto = require('crypto');
        const randomBytes = crypto.randomBytes(array.length);
        array.set(randomBytes);
        return array;
    }
};

try {
    global.fetch = require('jest-fetch-mock');
} catch (e) {
    global.fetch = jest.fn();
}

global.Blob = function Blob(data, options) {
    this.data = data;
    this.options = options;
};

global.Blob.prototype.arrayBuffer = function() {
    const data = this.data[0];
    if (typeof data === 'string') {
        return Promise.resolve(Buffer.from(data));
    }
    return Promise.resolve(data);
};

global.URL = {
    createObjectURL: jest.fn(function() { return 'mock://url'; }),
    revokeObjectURL: jest.fn()
};

global.indexedDB = {
    open: jest.fn(),
    deleteDatabase: jest.fn()
};

console.log('Jest setup completed');
