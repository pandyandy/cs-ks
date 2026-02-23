/**
 * Preprocess data for chart display, converting columns and adding missing combinations.
 */
export function preprocessForCharts(data) {
  const hodnotyValues = [0, 1, 2, 3, 4, 5];
  const vykonValues = [0, 1, 2, 3, 4, 5];
  const potencialValues = ['0', 'nízký', 'střední', 'vysoký'];

  const processed = data.map((row) => ({
    ...row,
    JAK: parseInt(row.HODNOTY, 10) || 0,
    CO: parseInt(row.VYKON, 10) || 0,
    JAK_PREVIOUS: parseInt(row.HODNOTY_PREVIOUS, 10) || 0,
    CO_PREVIOUS: parseInt(row.VYKON_PREVIOUS, 10) || 0,
    POTENCIAL: String(row.POTENCIAL || '0'),
    FULL_NAME_SPLIT: transformName(row.FULL_NAME || ''),
  }));

  // Add missing combinations for complete grid coverage
  const existingSet = new Set(
    processed.map((r) => `${r.JAK}_${r.CO}_${r.POTENCIAL}`)
  );

  for (const jak of hodnotyValues) {
    for (const co of vykonValues) {
      for (const pot of potencialValues) {
        const key = `${jak}_${co}_${pot}`;
        if (!existingSet.has(key)) {
          processed.push({
            JAK: jak,
            CO: co,
            POTENCIAL: pot,
            FULL_NAME: '',
            FULL_NAME_SPLIT: '',
          });
        }
      }
    }
  }

  return processed;
}

function transformName(name) {
  const parts = name.split(' ');
  if (parts.length > 1) {
    return `${parts[0]} ${parts[1][0]}.`;
  }
  return name;
}

/**
 * Categorize rows for 5x5 grid based on CO and JAK.
 */
export function categorize5Grid(co, jak) {
  if (co === 0 || jak === 0) return 'Nehodnocení';
  if (co >= 4 && jak >= 4) return 'Top';
  if (
    (co === 2 && jak >= 3) ||
    (co === 3 && jak >= 2) ||
    (co >= 4 && [2, 3].includes(jak))
  ) return 'Middle';
  if (co === 1 || jak === 1 || (co === 2 && jak <= 2)) return 'Low';
  return 'Nehodnocení';
}

/**
 * Categorize rows for 3x3 grid based on CO, JAK, and POTENCIAL.
 */
export function categorize3Grid(co, jak, potencial) {
  const sum = co + jak;
  if (potencial === '0' || sum === 0) return 'Nehodnocení';
  if (['nízký', 'střední'].includes(potencial) && sum >= 1 && sum <= 3) return 'Low';
  if (
    (potencial === 'vysoký' && sum >= 1 && sum <= 3) ||
    (['nízký', 'střední'].includes(potencial) && sum >= 4 && sum <= 7) ||
    (potencial === 'nízký' && sum >= 8 && sum <= 10)
  ) return 'Middle';
  if (
    (potencial === 'vysoký' && sum >= 4 && sum <= 7) ||
    (['střední', 'vysoký'].includes(potencial) && sum >= 8 && sum <= 10)
  ) return 'Top';
  return 'Nehodnocení';
}

/**
 * Build pivot table for 5x5 grid.
 */
export function build5GridPivot(data, period) {
  const suffix = period === 'previous' ? '_PREVIOUS' : '';
  const coKey = `CO${suffix}`;
  const jakKey = `JAK${suffix}`;

  const pivot = {};
  for (let co = 5; co >= 0; co--) {
    pivot[co] = {};
    for (let jak = 0; jak <= 5; jak++) {
      pivot[co][jak] = [];
    }
  }

  for (const row of data) {
    const co = row[coKey];
    const jak = row[jakKey];
    if (co != null && jak != null && pivot[co] && pivot[co][jak] != null) {
      if (row.FULL_NAME_SPLIT) {
        pivot[co][jak].push(row.FULL_NAME_SPLIT);
      }
    }
  }

  // Convert to array format for AG Grid
  const rows = [];
  for (let co = 5; co >= 0; co--) {
    const rowData = { [coKey]: co };
    for (let jak = 0; jak <= 5; jak++) {
      rowData[String(jak)] = pivot[co][jak].join(', ');
    }
    rows.push(rowData);
  }

  return rows;
}

/**
 * Build pivot table for 3x3 grid.
 */
export function build3GridPivot(data, period) {
  const suffix = period === 'previous' ? '_PREVIOUS' : '';
  const coKey = `CO${suffix}`;
  const jakKey = `JAK${suffix}`;
  const potKey = `POTENCIAL${suffix}`;

  const bins = [
    { label: '8-10', min: 8, max: 10 },
    { label: '4-7', min: 4, max: 7 },
    { label: '1-3', min: 1, max: 3 },
    { label: '0', min: 0, max: 0 },
  ];
  const potValues = ['nízký', 'střední', 'vysoký', '0'];

  const pivot = {};
  for (const bin of bins) {
    pivot[bin.label] = {};
    for (const pot of potValues) {
      pivot[bin.label][pot] = [];
    }
  }

  for (const row of data) {
    const co = row[coKey] || 0;
    const jak = row[jakKey] || 0;
    const pot = String(row[potKey] || '0');
    const sum = co + jak;

    const bin = bins.find((b) => sum >= b.min && sum <= b.max);
    if (bin && pivot[bin.label][pot] != null) {
      if (row.FULL_NAME_SPLIT) {
        pivot[bin.label][pot].push(row.FULL_NAME_SPLIT);
      }
    }
  }

  const rows = bins.map((bin) => {
    const rowData = { CO_JAK: bin.label };
    for (const pot of potValues) {
      rowData[pot] = pivot[bin.label][pot].join(', ');
    }
    return rowData;
  });

  return rows;
}

/**
 * Calculate category summary (Top, Middle, Low, Nehodnocení) with counts and percentages.
 */
export function calculateCategorySummary(data, categorize) {
  const categories = { Top: 0, Middle: 0, Low: 0, 'Nehodnocení': 0 };
  const validRows = data.filter((r) => r.USER_ID != null);
  const total = validRows.length;

  for (const row of validRows) {
    const cat = categorize(row);
    if (categories[cat] != null) {
      categories[cat]++;
    }
  }

  return Object.entries(categories).map(([name, count]) => ({
    name,
    count,
    percentage: total > 0 ? ((count / total) * 100).toFixed(2) : '0.00',
  }));
}

/**
 * Prepare trend chart data (average CO and JAK over years).
 */
export function prepareTrendData(fullData, filteredData) {
  const filteredUserIds = new Set(filteredData.map((r) => r.USER_ID));
  const userFilteredData = fullData.filter((r) => filteredUserIds.has(r.USER_ID));

  const yearGroups = {};
  for (const row of userFilteredData) {
    const year = row.YEAR;
    if (!yearGroups[year]) {
      yearGroups[year] = { jakSum: 0, coSum: 0, count: 0 };
    }
    yearGroups[year].jakSum += parseInt(row.HODNOTY, 10) || 0;
    yearGroups[year].coSum += parseInt(row.VYKON, 10) || 0;
    yearGroups[year].count++;
  }

  return Object.entries(yearGroups)
    .sort(([a], [b]) => a - b)
    .map(([year, { jakSum, coSum, count }]) => ({
      year,
      JAK: count > 0 ? jakSum / count : 0,
      CO: count > 0 ? coSum / count : 0,
    }));
}

/**
 * Prepare COMPARATIO chart data.
 */
export function prepareComparatioData(data) {
  const chartData = data.filter(
    (r) => r.USER_ID != null && r.COMPARATIO != null && r.JAK != null && r.CO != null
  );

  if (chartData.length === 0) return null;

  const processed = chartData.map((r) => ({
    ...r,
    JAK: parseInt(r.JAK, 10),
    CO: parseInt(r.CO, 10),
    COMPARATIO: parseInt(r.COMPARATIO, 10),
    JAK_CO_SUM: parseInt(r.CO, 10) + parseInt(r.JAK, 10),
    FULL_NAME_SPLIT: transformName(r.FULL_NAME || ''),
  }));

  // Group by position
  const positionGroups = {};
  for (const row of processed) {
    const key = `${row.JAK_CO_SUM}_${row.COMPARATIO}`;
    if (!positionGroups[key]) {
      positionGroups[key] = [];
    }
    positionGroups[key].push(row);
  }

  const bubbles = Object.entries(positionGroups).map(([key, group]) => ({
    x: group[0].JAK_CO_SUM,
    y: group[0].COMPARATIO,
    count: group.length,
    names: group.map((p) => `${p.FULL_NAME} (${p.CO}+${p.JAK})`),
    displayNames: group.map((p) => p.FULL_NAME_SPLIT),
    displayText:
      group.length === 1
        ? group[0].FULL_NAME_SPLIT
        : group.length <= 4
          ? `${group.length} lidi`
          : `${group.length} lidí`,
  }));

  // Calculate trend line
  const allX = processed.map((r) => r.JAK_CO_SUM);
  const allY = processed.map((r) => r.COMPARATIO);
  let trendLine = null;

  if (allX.length > 1) {
    const uniqueX = new Set(allX);
    if (uniqueX.size > 1) {
      const n = allX.length;
      const sumX = allX.reduce((a, b) => a + b, 0);
      const sumY = allY.reduce((a, b) => a + b, 0);
      const sumXY = allX.reduce((acc, x, i) => acc + x * allY[i], 0);
      const sumX2 = allX.reduce((acc, x) => acc + x * x, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      const minX = Math.min(...allX);
      const maxX = Math.max(...allX);
      const trendX = [];
      const trendY = [];
      for (let i = 0; i <= 100; i++) {
        const x = minX + (maxX - minX) * (i / 100);
        trendX.push(x);
        trendY.push(slope * x + intercept);
      }
      trendLine = { x: trendX, y: trendY };
    }
  }

  return {
    bubbles,
    trendLine,
    xRange: [Math.min(...allX) - 1, Math.max(...allX) + 1],
    yRange: [
      Math.min(...allY, ...(trendLine?.y || [])) - 5,
      Math.max(...allY, ...(trendLine?.y || [])) + 5,
    ],
  };
}
