import { describe, it, expect } from "vitest";
import { ensureWebflowPasteSafety, WEBFLOW_EMBED_CHAR_LIMIT } from "../lib/webflow-safety-gate";
import type { WebflowPayload } from "../lib/webflow-converter";

function makePayload(): WebflowPayload {
  return {
    type: "@webflow/XscpData",
    payload: {
      nodes: [],
      styles: [],
      assets: [],
      ix1: [],
      ix2: {
        interactions: [],
        events: [],
        actionLists: [],
      },
    },
    meta: {
      unlinkedSymbolCount: 0,
      droppedLinks: 0,
      dynBindRemovedCount: 0,
      dynListBindRemovedCount: 0,
      paginationRemovedCount: 0,
      hasEmbedCSS: false,
      hasEmbedJS: false,
      embedCSSSize: 0,
      embedJSSize: 0,
    },
  };
}

describe("webflow safety gate", () => {
  it("sanitizes HtmlEmbed content to avoid React #137 patterns", () => {
    const payload = makePayload();
    payload.payload.nodes.push({
      _id: "embed-1",
      type: "HtmlEmbed",
      tag: "div",
      classes: [],
      children: [],
      data: {
        embed: {
          type: "custom",
          meta: {
            html: "<span>Years<br>Experience</span>",
            div: true,
            iframe: false,
            script: false,
            compilable: false,
          },
        },
      },
      v: "<span>Years<br>Experience</span>",
    });

    const result = ensureWebflowPasteSafety({ payload });
    expect(result.blocked).toBe(false);

    const embedNode = result.payload.payload.nodes[0];
    const html = embedNode.data?.embed?.meta?.html || "";
    expect(html).toContain("<span>Years</span><br><span>Experience</span>");
  });

  it("removes invalid variant keys", () => {
    const payload = makePayload();
    payload.payload.styles.push({
      _id: "style-1",
      fake: false,
      type: "class",
      name: "button",
      namespace: "",
      comb: "button",
      styleLess: "color: red;",
      variants: {
        invalidVariant: { styleLess: "color: blue;" },
      },
      children: [],
    });

    const result = ensureWebflowPasteSafety({ payload });
    expect(result.blocked).toBe(false);

    const style = result.payload.payload.styles[0];
    expect(Object.keys(style.variants || {})).not.toContain("invalidVariant");
  });

  it("renames reserved w-* classes", () => {
    const payload = makePayload();
    payload.payload.styles.push({
      _id: "style-1",
      fake: false,
      type: "class",
      name: "w-nav",
      namespace: "",
      comb: "w-nav",
      styleLess: "display: block;",
      variants: {},
      children: [],
    });
    payload.payload.nodes.push({
      _id: "node-1",
      type: "Block",
      tag: "div",
      classes: ["style-1"],
      children: [],
    });

    const result = ensureWebflowPasteSafety({ payload });
    expect(result.blocked).toBe(false);
    const renamedStyle = result.payload.payload.styles[0];
    expect(renamedStyle.name).toBe("custom-nav");
    const nodeClasses = result.payload.payload.nodes[0].classes || [];
    expect(nodeClasses).toContain("style-1");
  });

  it("converts overly deep structures into HtmlEmbed nodes", () => {
    const payload = makePayload();
    const depth = 35;
    for (let i = 0; i < depth; i++) {
      payload.payload.nodes.push({
        _id: `node-${i}`,
        type: "Block",
        tag: "div",
        classes: [],
        children: i < depth - 1 ? [`node-${i + 1}`] : [],
      });
    }

    const result = ensureWebflowPasteSafety({ payload });
    const hasEmbed = result.payload.payload.nodes.some((node) => node.type === "HtmlEmbed");
    expect(hasEmbed).toBe(true);
  });

  it("blocks HtmlEmbed content that exceeds Webflow limits", () => {
    const payload = makePayload();
    payload.payload.nodes.push({
      _id: "embed-2",
      type: "HtmlEmbed",
      tag: "div",
      classes: [],
      children: [],
      data: {
        embed: {
          type: "custom",
          meta: {
            html: "a".repeat(WEBFLOW_EMBED_CHAR_LIMIT + 1),
            div: true,
            iframe: false,
            script: false,
            compilable: false,
          },
        },
      },
    });

    const result = ensureWebflowPasteSafety({ payload });
    expect(result.blocked).toBe(true);
    expect(result.report.embedSize.errors.length).toBeGreaterThan(0);
  });

  it("blocks CSS embeds that exceed Webflow limits", () => {
    const payload = makePayload();
    const result = ensureWebflowPasteSafety({
      payload,
      cssEmbed: "a".repeat(WEBFLOW_EMBED_CHAR_LIMIT + 1),
    });
    expect(result.blocked).toBe(true);
    expect(result.report.embedSize.errors.some((issue) => issue.includes("CSS embed"))).toBe(true);
  });

  it("remaps class name references to style IDs when unambiguous", () => {
    const payload = makePayload();
    payload.payload.styles.push({
      _id: "style-1",
      fake: false,
      type: "class",
      name: "button-primary",
      namespace: "",
      comb: "button-primary",
      styleLess: "background: blue;",
      variants: {},
      children: [],
    });
    payload.payload.nodes.push({
      _id: "node-1",
      type: "Block",
      tag: "div",
      classes: ["button-primary"],
      children: [],
    });

    const result = ensureWebflowPasteSafety({ payload });
    const nodeClasses = result.payload.payload.nodes[0].classes || [];
    expect(nodeClasses).toContain("style-1");
  });
});
