const SuiteCloudJestConfiguration = require("@oracle/suitecloud-unit-testing/jest-configuration/SuiteCloudJestConfiguration");

const config = SuiteCloudJestConfiguration.build({
  projectFolder: "src",
  projectType: SuiteCloudJestConfiguration.ProjectType.SUITEAPP,
});

// NetSuite provides `log` as a global in server-side scripts.
// This setup file makes it available in the Jest test environment.
config.setupFiles = ["./jest.setup.js"];

module.exports = config;
