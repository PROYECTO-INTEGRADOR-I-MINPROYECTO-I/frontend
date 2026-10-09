import { describe, expect, test } from "vitest";
import { eventDoodleKind } from "./event-display";

describe("eventDoodleKind", () => {
  test.each([
    ["Boda", "social"],
    ["Social", "social"],
    ["Cumpleaños", "social"],
    ["boda", "social"], // insensible a mayúsculas
    [" Cumpleaños ", "social"], // insensible a espacios sobrantes
  ])("%s -> %s", (eventTypeName, expected) => {
    expect(eventDoodleKind(eventTypeName)).toBe(expected);
  });

  test("Corporativo -> corporate", () => {
    expect(eventDoodleKind("Corporativo")).toBe("corporate");
  });

  test.each([
    ["Otro", "alternative"],
    ["Conferencia de prensa", "alternative"], // tipo personalizado sin calce
    [null, "alternative"],
    [undefined, "alternative"],
    ["", "alternative"],
  ])("%s -> %s", (eventTypeName, expected) => {
    expect(eventDoodleKind(eventTypeName)).toBe(expected);
  });
});
