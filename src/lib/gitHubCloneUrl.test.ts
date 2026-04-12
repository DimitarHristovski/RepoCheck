import { describe, expect, it } from "vitest";
import {
  isValidCloneHttpUrl,
  normalizeGithubRepoUrl,
  parseGithubOwnerRepoFromWebUrl,
} from "./gitHubCloneUrl";

describe("normalizeGithubRepoUrl", () => {
  it("handles owner/repo shorthand", () => {
    expect(normalizeGithubRepoUrl("facebook/react")).toBe("https://github.com/facebook/react.git");
  });

  it("handles github.com without scheme", () => {
    expect(normalizeGithubRepoUrl("github.com/octocat/Hello-World")).toBe(
      "https://github.com/octocat/Hello-World.git"
    );
  });

  it("strips tree path", () => {
    expect(
      normalizeGithubRepoUrl("https://github.com/microsoft/vscode/tree/main/src")
    ).toBe("https://github.com/microsoft/vscode.git");
  });

  it("converts SSH to HTTPS", () => {
    expect(normalizeGithubRepoUrl("git@github.com:octocat/Spoon-Knife.git")).toBe(
      "https://github.com/octocat/Spoon-Knife.git"
    );
  });

  it("keeps explicit https .git", () => {
    expect(normalizeGithubRepoUrl("https://github.com/octocat/Hello-World.git")).toBe(
      "https://github.com/octocat/Hello-World.git"
    );
  });

  it("preserves PAT in URL userinfo", () => {
    expect(normalizeGithubRepoUrl("https://ghp_xxxxx@github.com/octocat/Hello-World")).toBe(
      "https://ghp_xxxxx@github.com/octocat/Hello-World.git"
    );
  });
});

describe("parseGithubOwnerRepoFromWebUrl", () => {
  it("parses https github repo", () => {
    expect(parseGithubOwnerRepoFromWebUrl("https://github.com/octocat/Hello-World")).toEqual({
      owner: "octocat",
      repo: "Hello-World",
    });
  });
  it("rejects credentials", () => {
    expect(
      parseGithubOwnerRepoFromWebUrl("https://x-access-token:abc@github.com/octocat/Hello-World")
    ).toBeNull();
  });
});

describe("isValidCloneHttpUrl", () => {
  it("accepts https", () => {
    expect(isValidCloneHttpUrl("https://github.com/a/b.git")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidCloneHttpUrl("not a url")).toBe(false);
  });
});
