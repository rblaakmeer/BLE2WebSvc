module.exports = {
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",

  // A list of paths to directories that Jest should use to search for files in
  roots: [
    "<rootDir>/__tests__"
  ],

  // The test environment that will be used for testing
  testEnvironment: "node",

  // Jest will look for files with .test.js or .spec.js extensions
  testRegex: "(/__tests__/.*|(\.|/)(test|spec))\.js$",

  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Setup a mock for the 'noble' library
  // This tells Jest to look for a manual mock in a __mocks__ directory
  // when 'noble' is required in tests.
  moduleNameMapper: {
    "^noble$": "<rootDir>/__mocks__/noble.js"
  }
};
