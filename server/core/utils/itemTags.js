function parseItemTags(value) {
  let tags = value ?? [];
  if (typeof tags === 'string') {
    try {
      tags = JSON.parse(tags);
    } catch {
      tags = [];
    }
  }
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0);
}

function serializeItemTags(value) {
  return JSON.stringify(parseItemTags(value));
}

module.exports = {
  parseItemTags,
  serializeItemTags,
};
