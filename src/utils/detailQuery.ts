export const detailQuery = `query AnimeDetails($id: Int) {
  Media(id: $id, type: ANIME) {
    id idMal title { english romaji } bannerImage coverImage { extraLarge } description episodes averageScore
    seasonYear format status genres studios(isMain:true){nodes{name}} nextAiringEpisode { episode }
    relations { edges { relationType node { id idMal title { english romaji } coverImage { extraLarge } type bannerImage description episodes averageScore nextAiringEpisode { episode } } } }
  }
}`;
