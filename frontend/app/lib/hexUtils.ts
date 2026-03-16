// ─── Types ──────────────────────────────────────────────────

export interface HexCell {
    id: string;
    row: number;
    col: number;
    letter: string;
    owner: "orange" | "green" | null;
    isSelected: boolean;
}

export type GridLayout = HexCell[][];

// 25 Arabic letters
export const ARABIC_LETTERS = [
    "أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ر", "ز",
    "س", "ش", "ص", "ط", "ع", "غ", "ف", "ق", "ك", "ل",
    "م", "ن", "ه", "و", "ي",
];

// ─── Hex SVG Math ───────────────────────────────────────────

/**
 * Compute SVG center for a hex cell (pointy-top layout, odd-row offset).
 */
export function hexCenter(
    row: number,
    col: number,
    size: number
): { cx: number; cy: number } {
    const w = Math.sqrt(3) * size;
    const h = 2 * size;
    const isOdd = ((row % 2) + 2) % 2 === 1;
    return {
        cx: col * w + (isOdd ? w / 2 : 0) + w / 2,
        cy: row * (h * 0.75) + size,
    };
}

/**
 * SVG polygon points for a pointy-top hexagon at (cx, cy).
 */
export function hexPoints(cx: number, cy: number, size: number): string {
    const angles = [30, 90, 150, 210, 270, 330];
    return angles
        .map((a) => {
            const rad = (a * Math.PI) / 180;
            return `${cx + size * Math.cos(rad)},${cy + size * Math.sin(rad)}`;
        })
        .join(" ");
}

/**
 * Compute viewBox bounds for a grid of given size.
 */
export function computeViewBox(
    gridSize: number,
    hexSize: number,
    borderHexes: { row: number; col: number }[]
): string {
    const allCenters = [
        // Grid cells
        ...Array.from({ length: gridSize }, (_, r) =>
            Array.from({ length: gridSize }, (_, c) => hexCenter(r, c, hexSize))
        ).flat(),
        // Border hexes
        ...borderHexes.map((b) => hexCenter(b.row, b.col, hexSize)),
    ];

    const pad = hexSize + 6;
    const xs = allCenters.map((p) => p.cx);
    const ys = allCenters.map((p) => p.cy);
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const maxX = Math.max(...xs) + pad;
    const maxY = Math.max(...ys) + pad;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
}

/**
 * Build border hex positions for a given grid size.
 */
export function buildBorderHexes(
    gridSize: number
): { row: number; col: number; team: "orange" | "green" }[] {
    const out: { row: number; col: number; team: "orange" | "green" }[] = [];
    // Left+Right columns (orange)
    for (let r = 0; r < gridSize; r++) out.push({ row: r, col: -1, team: "orange" });
    for (let r = 0; r < gridSize; r++) out.push({ row: r, col: gridSize, team: "orange" });
    // Top+Bottom rows (green)
    for (let c = -1; c < gridSize; c++) out.push({ row: -1, col: c, team: "green" });
    for (let c = -1; c < gridSize; c++) out.push({ row: gridSize, col: c, team: "green" });
    return out;
}

// ─── Win Check (for display) ────────────────────────────────

export function checkWin(
    grid: GridLayout,
    team: "orange" | "green"
): boolean {
    const gridSize = grid.length;
    if (gridSize === 0) return false;

    if (team === "orange") {
        const starts = grid.flatMap((row) =>
            row.filter((c) => c.col === 0 && c.owner === "orange")
        );
        return bfsReach(grid, starts, "orange", (c) => c.col === gridSize - 1, gridSize);
    } else {
        const starts = grid[0].filter((c) => c.owner === "green");
        return bfsReach(grid, starts, "green", (c) => c.row === gridSize - 1, gridSize);
    }
}

function bfsReach(
    grid: GridLayout,
    starts: HexCell[],
    team: string,
    goal: (c: HexCell) => boolean,
    gridSize: number
): boolean {
    const visited = new Set<string>();
    const queue: HexCell[] = [...starts];
    starts.forEach((c) => visited.add(c.id));

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (goal(current)) return true;

        for (const [nr, nc] of getNeighbors(current.row, current.col, gridSize)) {
            const neighbor = grid[nr][nc];
            if (!visited.has(neighbor.id) && neighbor.owner === team) {
                visited.add(neighbor.id);
                queue.push(neighbor);
            }
        }
    }
    return false;
}

function getNeighbors(row: number, col: number, gridSize: number): [number, number][] {
    const isOddRow = row % 2 === 1;
    const directions: [number, number][] = isOddRow
        ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]
        : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];

    return directions
        .map(([dr, dc]) => [row + dr, col + dc] as [number, number])
        .filter(([r, c]) => r >= 0 && r < gridSize && c >= 0 && c < gridSize);
}
