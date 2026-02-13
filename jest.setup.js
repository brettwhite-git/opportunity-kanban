// NetSuite provides `log` as a global object in server-side scripts.
// This setup file makes it available in Jest tests.
global.log = {
    debug: jest.fn(),
    audit: jest.fn(),
    error: jest.fn(),
    emergency: jest.fn()
};
    