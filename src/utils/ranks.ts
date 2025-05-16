export interface Rank {
  value: number;
  name: string;
  image: string;
  textColorClass?: string; 
}

export const ROCKET_LEAGUE_RANKS: Rank[] = [
  { value: 1, name: "Bronze", image: "/images/ranks/bronze.png", textColorClass: "text-yellow-600" },
  { value: 2, name: "Silver", image: "/images/ranks/silver.png", textColorClass: "text-gray-400" },
  { value: 3, name: "Gold", image: "/images/ranks/gold.png", textColorClass: "text-yellow-500" },
  { value: 4, name: "Platinum", image: "/images/ranks/platinum.png", textColorClass: "text-teal-400" },
  { value: 5, name: "Diamond", image: "/images/ranks/diamond.png", textColorClass: "text-blue-400" },
  { value: 6, name: "Champion", image: "/images/ranks/champion.png", textColorClass: "text-purple-500" },
  { value: 7, name: "Grand Champion", image: "/images/ranks/grandchampion.png", textColorClass: "text-red-500" },
  { value: 8, name: "Supersonic Legend", image: "/images/ranks/supersoniclegend.png", textColorClass: "text-pink-500" }, // Assuming you have ssl.png
];

export const getRankByValue = (value: number | null | undefined): Rank | undefined => {
  if (value === null || value === undefined) return undefined;
  return ROCKET_LEAGUE_RANKS.find(rank => rank.value === value);
};