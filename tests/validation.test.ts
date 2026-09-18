import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  clockTime,
  isoDate,
  passwordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation.ts";

/**
 * These schemas are the trust boundary: they are what stands between a hand-
 * crafted request body and the database. The cases below are the ones a
 * regex is most likely to wave through by accident.
 */

describe("isoDate", () => {
  test("accepts a well-formed date", () => {
    assert.equal(isoDate.safeParse("2026-09-17").success, true);
  });

  test("rejects other formats and junk", () => {
    for (const bad of ["17-09-2026", "2026-9-7", "2026/09/17", "", "yesterday"]) {
      assert.equal(isoDate.safeParse(bad).success, false, `accepted ${bad}`);
    }
  });
});

describe("clockTime", () => {
  test("accepts the whole 24-hour range", () => {
    for (const good of ["00:00", "09:30", "23:59"]) {
      assert.equal(clockTime.safeParse(good).success, true, `rejected ${good}`);
    }
  });

  test("rejects out-of-range and unpadded times", () => {
    for (const bad of ["24:00", "23:60", "9:30", "0930", "", "25:00"]) {
      assert.equal(clockTime.safeParse(bad).success, false, `accepted ${bad}`);
    }
  });
});

describe("passwordSchema", () => {
  test("accepts a password with letters and digits", () => {
    assert.equal(passwordSchema.safeParse("demo12345").success, true);
  });

  test("rejects one that is too short", () => {
    assert.equal(passwordSchema.safeParse("abc123").success, false);
  });

  test("rejects letters-only and digits-only", () => {
    assert.equal(passwordSchema.safeParse("abcdefghij").success, false);
    assert.equal(passwordSchema.safeParse("1234567890").success, false);
  });

  test("explains itself in Albanian", () => {
    const result = passwordSchema.safeParse("abc");
    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0].message, /Fjalëkalimi/);
    }
  });
});

describe("signUpSchema", () => {
  const valid = {
    name: "Ana",
    surname: "Hoxha",
    email: "Ana@Example.COM",
    password: "demo12345",
    confirm: "demo12345",
  };

  test("accepts a complete form and lowercases the email", () => {
    const result = signUpSchema.safeParse(valid);
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.email, "ana@example.com");
  });

  test("rejects mismatched confirmation, pointing at the right field", () => {
    const result = signUpSchema.safeParse({ ...valid, confirm: "something-else" });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.deepEqual(result.error.issues[0].path, ["confirm"]);
    }
  });

  test("rejects an invalid email", () => {
    assert.equal(
      signUpSchema.safeParse({ ...valid, email: "not-an-email" }).success,
      false
    );
  });

  test("rejects a one-character name", () => {
    assert.equal(signUpSchema.safeParse({ ...valid, name: "A" }).success, false);
  });
});

describe("signInSchema", () => {
  test("normalises the email and keeps the password verbatim", () => {
    const result = signInSchema.safeParse({
      email: "  Ana@Example.com  ",
      password: " spaces matter ",
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.email, "ana@example.com");
      assert.equal(result.data.password, " spaces matter ");
    }
  });

  test("requires a password", () => {
    assert.equal(
      signInSchema.safeParse({ email: "ana@example.com", password: "" }).success,
      false
    );
  });
});
