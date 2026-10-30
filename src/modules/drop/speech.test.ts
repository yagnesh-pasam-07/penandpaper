import { describe, expect, it } from "vitest";
import { defaultSpeechLang, mergeSpeech, parseSpeechLang, resultsFrom, speechCtor, speechErrorMessage, speechTag, spokenSoFar } from "./speech";

describe("speech language", () => {
  it("starts in English, whatever the browser's language (English only for now)", () => {
    expect(defaultSpeechLang("hi-IN")).toBe("en");
    expect(defaultSpeechLang("te")).toBe("en");
    expect(defaultSpeechLang("en-US")).toBe("en");
    expect(defaultSpeechLang("fr-FR")).toBe("en");
    expect(defaultSpeechLang(undefined)).toBe("en");
    expect(defaultSpeechLang("")).toBe("en");
  });

  it("only accepts a language it offers", () => {
    expect(parseSpeechLang("en")).toBe("en");
    expect(parseSpeechLang("hi")).toBeNull();
    expect(parseSpeechLang("xx")).toBeNull();
    expect(parseSpeechLang(null)).toBeNull();
  });

  it("gives English the browser's own English and Indian English otherwise", () => {
    expect(speechTag("en", "en-US")).toBe("en-US");
    expect(speechTag("en", "en-GB")).toBe("en-GB");
    expect(speechTag("en", "en-IN")).toBe("en-IN");
    expect(speechTag("en", "fr-FR")).toBe("en-IN");
    expect(speechTag("en", "en")).toBe("en-IN");
    expect(speechTag("en", undefined)).toBe("en-IN");
  });
});

describe("what was heard", () => {
  it("splits settled words from the ones still being guessed", () => {
    expect(
      mergeSpeech([
        { transcript: " call the bank ", isFinal: true },
        { transcript: "and then", isFinal: true },
        { transcript: "pay ren", isFinal: false },
      ]),
    ).toEqual({ final: "call the bank and then", interim: "pay ren" });
  });

  it("joins everything so far into one run of text, with no stray spaces", () => {
    expect(spokenSoFar([{ transcript: "hello", isFinal: true }, { transcript: " world", isFinal: false }])).toBe("hello world");
    expect(spokenSoFar([{ transcript: "", isFinal: false }])).toBe("");
    expect(spokenSoFar([])).toBe("");
  });

  it("reads a browser result list into plain results", () => {
    const list = [Object.assign([{ transcript: "one" }], { isFinal: true }), Object.assign([{ transcript: "two" }], { isFinal: false }), Object.assign([], { isFinal: true })];
    expect(resultsFrom(list)).toEqual([
      { transcript: "one", isFinal: true },
      { transcript: "two", isFinal: false },
      { transcript: "", isFinal: true },
    ]);
  });
});

describe("recogniser errors", () => {
  it("says something helpful for the ones a person can act on", () => {
    expect(speechErrorMessage("not-allowed")).toMatch(/blocked/);
    expect(speechErrorMessage("service-not-allowed")).toMatch(/blocked/);
    expect(speechErrorMessage("no-speech")).toBe("Didn't catch anything.");
    expect(speechErrorMessage("network")).toMatch(/internet/);
    expect(speechErrorMessage("audio-capture")).toMatch(/No microphone/);
    expect(speechErrorMessage("language-not-supported")).toMatch(/language/);
    expect(speechErrorMessage("something-new")).toMatch(/Try again/);
  });

  it("stays quiet when we stopped it ourselves", () => {
    expect(speechErrorMessage("aborted")).toBeNull();
  });
});

describe("finding the browser's recogniser", () => {
  it("prefers the unprefixed class, then the prefixed one, and is null in Firefox", () => {
    class A {}
    class B {}
    expect(speechCtor({ SpeechRecognition: A, webkitSpeechRecognition: B })).toBe(A);
    expect(speechCtor({ webkitSpeechRecognition: B })).toBe(B);
    expect(speechCtor({})).toBeNull();
    expect(speechCtor(undefined)).toBeNull();
    expect(speechCtor({ SpeechRecognition: "nope" })).toBeNull();
  });
});
