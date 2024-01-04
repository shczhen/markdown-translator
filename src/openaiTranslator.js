import * as fs from "fs";

import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { get_encoding } from "tiktoken";

import { executeLangLinkTranslator } from "./langlinkClient.js";
import { writeFileSync } from "./lib.js";

const createNewRoot = () => ({ type: "root", children: [] });

export const translateMDFile = async (filePath, glossaryMatcher) => {
  const mdFileContent = fs.readFileSync(filePath).toString();
  const [meta, content] = splitMetaContent(mdFileContent);
  const glossary = glossaryMatcher(content);

  const headings = extractHeadings(content);
  const contentSegments = contentSplit(content, "heading")
    .map((seg) =>
      seg.skip
        ? seg
        : // preserve \n from openai output
          // \n\nabc\nbcd\n -> ['', '', 'abc\nbcd', ''].join('\n')
          seg.content
            .split(/^\n+|\n+$/g)
            .map((c) => ({ content: c, skip: !!c ? seg.skip : true }))
    )
    .flat();

  const dataArr = await Promise.all(
    contentSegments.map((seg) => {
      if (seg.skip) {
        return Promise.resolve(seg.content);
      }
      return executeLangLinkTranslator(seg.content, glossary);
    })
  );
  const data = dataArr.join("\n").trim();
  const result = concatHeadings(data, headings);
  const contentWithMeta = `${meta ? `${meta}\n` : ""}${result}`;

  writeFileSync(`output/${filePath}`, contentWithMeta);
};

const metaReg = /---\n/;

const splitMetaContent = (originalText) => {
  const [_, meta, ...content] = originalText.split(metaReg);
  if (!meta) {
    return [undefined, originalText];
  }
  return [`---\n${meta}---\n`, content.join("---\n")];
};

const fromMarkdownContent = (content) =>
  fromMarkdown(content, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });

const toMarkdownContent = (astNode) =>
  toMarkdown(astNode, {
    bullet: "-",
    listItemIndent: "one",
    fences: true,
    extensions: [gfmToMarkdown()],
  });

const MAX_TOKEN = 1024;
const TIKTOKEN_ENCODING = "cl100k_base";

const createSegment = (content, skip = false) => ({ content, skip });
const skipTypes = ["code"];

const contentSplit = (content, by) => {
  const enc = get_encoding(TIKTOKEN_ENCODING);
  const numTokens = enc.encode(content).length;
  if (numTokens < MAX_TOKEN) {
    return [createSegment(content)];
  }

  const root = fromMarkdownContent(content);
  const segments = [];
  let segment = createNewRoot();
  const pushSegmentContent = () => {
    const segmentContent = toMarkdownContent(segment);
    const numTokens = enc.encode(segmentContent).length;
    if (numTokens > MAX_TOKEN) {
      console.log(`Too large paragraph:\n${segmentContent.slice(0, 100)}...`);
      throw new Error(
        `Too large paragraph:\n${segmentContent.slice(0, 100)}...`
      );
    }

    segments.push(createSegment(segmentContent, numTokens > MAX_TOKEN));
    segment.children = [];
  };
  root.children.forEach((node) => {
    if (skipTypes.includes(node.type)) {
      pushSegmentContent();
      // insert skip node into segments
      const newRoot = createNewRoot();
      newRoot.children.push(node);
      segments.push(createSegment(toMarkdownContent(newRoot), true));
      return;
    }

    const tempSegment = createNewRoot();
    tempSegment.children = [...segment.children, node];
    const tempSegmentContent = toMarkdownContent(tempSegment);
    const tempNumTokens = enc.encode(tempSegmentContent).length;
    const willReachLimit = tempNumTokens > MAX_TOKEN;

    if (
      (node.type === by && !!segment.children.length && willReachLimit) ||
      willReachLimit
    ) {
      pushSegmentContent();
      segment.children.push(node);
      return;
    }

    segment.children.push(node);
  });

  if (!!segment.children.length) {
    pushSegmentContent();
  }

  return segments;
};

const extractHeadings = (content) => {
  const root = fromMarkdownContent(content);
  return root.children
    .filter((node) => node.type === "heading")
    .map((node) => ({
      level: node.depth,
      content: enStr2AnchorFormat(toMarkdownContent(node)),
    }));
};

const concatHeadings = (content, headings) => {
  const root = fromMarkdownContent(content);
  const contentHeadings = root.children.filter(
    (node) => node.type === "heading"
  );

  headings.forEach((heading, index) => {
    const contentHeading = contentHeadings[index];
    if (contentHeading.depth !== heading.level) {
      throw new Error(
        `The wrong level has been matched. Heading level: ${heading.level}, text: ${heading.content}; Content Heading level: ${contentHeading.depth}, text: ${contentHeading.children[0].value}`
      );
    }
    contentHeading.children.push({
      type: "text",
      value: ` {#${heading.content}}`,
    });
  });

  return toMarkdownContent(root);
};

const enStr2AnchorFormat = (headingStr) => {
  // trim spaces and transform characters to lower case
  const text = headingStr.trim().toLowerCase();
  // \W is the negation of shorthand \w for [A-Za-z0-9_] word characters (including the underscore)
  const result = text.replace(/[\W_]+/g, "-").replace(/^-+|-+$/g, "");
  return result;
};
