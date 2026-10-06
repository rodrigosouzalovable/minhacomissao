import { describe, expect, test } from "bun:test";
import { resolveMetaButtonRedirect } from "../src/lib/metaButtonRedirect";

describe("Meta dynamic button redirects", () => {
  test("opens the supplied WhatsApp link despite the encoded template marker", () => {
    expect(resolveMetaButtonRedirect("/%7B%7B1%7D%7Dhttps://w.app/czafpg"))
      .toBe("https://w.app/czafpg");
  });
  test("accepts an unencoded marker", () => {
    expect(resolveMetaButtonRedirect("/{{1}}https://w.app/czafpg"))
      .toBe("https://w.app/czafpg");
  });
  test("preserves existing external redirects", () => {
    expect(resolveMetaButtonRedirect("/https://sathgoldficha.42web.io/inss/number/ame_0826.php"))
      .toBe("https://sathgoldficha.42web.io/inss/number/ame_0826.php");
  });
  test("preserves escaped destination parameters and fragments", () => {
    expect(resolveMetaButtonRedirect("/%7b%7b1%7d%7dhttps://w.app/czafpg?text=a%26b#info"))
      .toBe("https://w.app/czafpg?text=a%26b#info");
  });
  test("does not redirect internal pages or executable schemes", () => {
    expect(resolveMetaButtonRedirect("/admin/envio-meta")).toBeNull();
    expect(resolveMetaButtonRedirect("/{{1}}javascript:alert(1)")).toBeNull();
  });
});