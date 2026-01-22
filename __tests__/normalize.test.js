const { normalizeSub } = require("../src/options.js");

describe("normalizeSub", () => {
  test("removes leading /r/ or r/ and trims slashes and whitespace", () => {
    expect(normalizeSub("/r/foo")).toBe("foo");
    expect(normalizeSub("r/bar")).toBe("bar");
    expect(normalizeSub(" /r/baz/ ")).toBe("baz");
    expect(normalizeSub("///r/qux///")).toBe("qux");
    expect(normalizeSub(null)).toBe("");
    expect(normalizeSub("")).toBe("");
  });
});
