export function calculateRewardPercentages(data: any) {
  const { totalEligibleForReward, totalRewardCollected } = data;

  const total = totalEligibleForReward + totalRewardCollected;

  if (total === 0) {
    return {
      collectedPercentage: 0,
      notCollectedPercentage: 0,
    };
  }

  const collectedPercentage = (totalRewardCollected / total) * 100;
  const notCollectedPercentage = (totalEligibleForReward / total) * 100;

  return {
    collectedPercentage: parseFloat(collectedPercentage.toFixed(2)),
    notCollectedPercentage: parseFloat(notCollectedPercentage.toFixed(2)),
  };
}
