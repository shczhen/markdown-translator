import { TranslationServiceClient } from "@google-cloud/translate";

// Instantiates a client
const translationClient = new TranslationServiceClient();

const projectId = process.env.PROJECT_ID || "";
const location = "us-central1";
const glossaryId = process.env.GLOSSARY_ID || "";
// const text = "Hello, world!";
// const textList = ["Hello, world!", "This is a test app."];

export async function translateText(
  contents = [],
  mimeType = "text/html",
  srcLang = "en",
  targetLang = "ja"
) {
  const glossaryConfig = {
    glossary: `projects/${projectId}/locations/${location}/glossaries/${glossaryId}`,
  };
  // Construct request
  const request = {
    parent: `projects/${projectId}/locations/${location}`,
    contents,
    mimeType, // mime types: text/plain, text/html
    sourceLanguageCode: srcLang,
    targetLanguageCode: targetLang,
  };
  glossaryId && (request.glossaryConfig = glossaryConfig);
  console.log(`>>>gcp translate ${glossaryId}>>>`, ...contents);
  // Run request
  const [response] = await translationClient.translateText(request);

  // for (const translation of response.translations) {
  //   console.log(`Translation: ${translation.translatedText}`);
  // }
  return response.translations.map((data) => `${data.translatedText}`);
}

export async function translateSingleText(
  contents = "",
  mimeType = "text/plain",
  srcLang = "en",
  targetLang = "ja"
) {
  if (!contents || typeof contents !== "string") {
    return [""];
  }
  if (/^<span translate="no">([0-9]+)<\/span>$/.test(contents)) {
    console.log(">>>gcp **NO** translate >>> ", ...contents);
    return [contents];
  }
  if (
    contents.startsWith(`{{< copyable`) ||
    contents.startsWith(`{{&#x3C; copyable`)
  ) {
    console.log(">>>gcp **NO** translate >>> ", ...contents);
    return [`{{< copyable "" >}}`];
  }
  return translateText([contents], mimeType, srcLang, targetLang);
}
