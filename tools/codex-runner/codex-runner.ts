import "dotenv/config";
import { execSync } from "child_process";
import OpenAI from "openai";
import simpleGit from "simple-git";
import fs from "fs";
import path from "path";

console.log("📌 Startar script... laddar miljövariabler");

const {
  OPENAI_API_KEY,
  GITHUB_TOKEN,
  REPO_URL,
  BRANCH_PREFIX = "codex",
} = process.env;

console.log({
  OPENAI_API_KEY: !!OPENAI_API_KEY,
  GITHUB_TOKEN: !!GITHUB_TOKEN,
  REPO_URL,
});

if (!OPENAI_API_KEY || !GITHUB_TOKEN || !REPO_URL) {
  console.error("❌ Saknade miljövariabler");
  process.exit(1);
}

const run = async () => {
  console.log("🚀 Codex Runner startar...");
  const tmpDir = fs.mkdtempSync("./tmp-codex-");
  const repoName = REPO_URL.split("/").pop()?.replace(".git", "") ?? "repo";
  const branchName = `${BRANCH_PREFIX}/${Date.now()}`;

  const git = simpleGit();

  console.log(`🔁 Klonar repo till ${tmpDir}...`);
  const authUrl = REPO_URL.replace("https://", `https://${GITHUB_TOKEN}@`);
  await git.clone(authUrl, tmpDir);

  process.chdir(tmpDir);
  await git.checkoutLocalBranch(branchName);

  console.log("📁 Innehåll i repo efter klon:");
  console.log(fs.readdirSync(".", { withFileTypes: true }).map((f) => f.name));

  const toolsPath = path.join("tools");
  console.log(
    "📁 Innehåll i tools/:",
    fs.readdirSync(toolsPath, { withFileTypes: true }).map((f) => f.name),
  );

  const runnerPath = path.join("tools", "codex-runner");
  console.log(
    "📁 Innehåll i tools/codex-runner/:",
    fs.readdirSync(runnerPath, { withFileTypes: true }).map((f) => f.name),
  );

  const promptPath = path.join("tools/codex-runner/codexprompt.md");

  if (!fs.existsSync(promptPath)) {
    console.error("❌ Hittar inte codexprompt.md");
    return;
  }

  const prompt = fs.readFileSync(promptPath, "utf8");
  console.log("📤 Skickar prompt till OpenAI...");

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "system", content: prompt }],
    temperature: 0.2,
  });

  const result = completion.choices[0]?.message?.content ?? "// Tomt svar";

  const outputFile = path.join("codex-output.md");
  fs.writeFileSync(outputFile, result);

  await git.add(outputFile);
  await git.commit(`codex: auto-refactor ${Date.now()}`);
  await git.push("origin", branchName);

  console.log(`✅ Pushat branch ${branchName}`);
  console.log(
    `👉 Skapa PR på: https://github.com/${REPO_URL.split("/").slice(-2).join("/").replace(".git", "")}/compare/${branchName}?expand=1`,
  );
};

run().catch((err) => {
  console.error("❌ Codex-runner kraschade:", err);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log("🧹 Rensade temporär mapp:", tmpDir);
});
