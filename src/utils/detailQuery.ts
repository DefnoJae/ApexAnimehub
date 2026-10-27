export const detailQuery = `query AnimeDetails($id: Int) {
  Media(id: $id, type: ANIME) {
    id idMal title { english romaji } bannerImage coverImage { extraLarge } description episodes averageScore
    seasonYear format status genres studios(isMain:true){nodes{name}} nextAiringEpisode { episode }
    recommendations(sort:RATING_DESC,perPage:24){nodes{mediaRecommendation{id idMal type isAdult title{english romaji} coverImage{extraLarge} bannerImage episodes averageScore}}}
    relations { edges { relationType node { id idMal title { english romaji } coverImage { extraLarge } type bannerImage description episodes averageScore nextAiringEpisode { episode } } } }
  }
}`;
