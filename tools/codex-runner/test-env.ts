import 'dotenv/config';

console.log('🔍 Testar env-laddning...');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY?.slice(0, 10));
console.log('GITHUB_TOKEN:', process.env.GITHUB_TOKEN?.slice(0, 10));
console.log('REPO_URL:', process.env.REPO_URL);
