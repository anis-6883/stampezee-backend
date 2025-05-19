export function calculatePercentages(data: any) {
  let total = 0;
  let counts: any = {
    true: 0,
    false: 0,
  };

  data.forEach((item: any) => {
    total += item.totalCount;
    counts[item._id] += item.totalCount;
  });

  const percentages =
    total === 0
      ? { true: 0, false: 0 }
      : {
          true: Number(((counts.true / total) * 100).toFixed(2)),
          false: Number(((counts.false / total) * 100).toFixed(2)),
        };

  return {
    totalCount: total,
    counts,
    percentages,
  };
}
