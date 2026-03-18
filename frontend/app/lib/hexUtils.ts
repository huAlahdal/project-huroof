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
