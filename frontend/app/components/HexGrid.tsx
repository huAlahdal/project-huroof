import { useMemo, memo } from "react";
import type { GridLayout } from "~/lib/hexUtils";
import { hexCenter, hexPoints, buildBorderHexes, computeViewBox } from "~/lib/hexUtils";

interface HexGridProps {
    grid: GridLayout;
    gridSize: number;
    onCellClick?: (id: string) => void;
    onOwnedCellClick?: (id: string, currentOwner: string) => void;
    interactive?: boolean;
    isGameMaster?: boolean;
    hexSize?: number;
}

const TEAM_COLORS = {
    orange: { fill: "#f97316", stroke: "#ea580c", text: "#fff" },
    green: { fill: "#22c55e", stroke: "#16a34a", text: "#fff" },
    empty: { fill: "#1e1b3a", stroke: "#6d28d9", text: "#c4b5fd" },
    selected: { fill: "#7c3aed", stroke: "#a855f7", text: "#fff" },
};

const HexGrid = memo(function HexGrid({
    grid,
    gridSize,
    onCellClick,
    onOwnedCellClick,
    interactive = false,
    isGameMaster = false,
    hexSize = 52,
}: HexGridProps) {
    const borderHexes = useMemo(() => buildBorderHexes(gridSize), [gridSize]);

    const viewBox = useMemo(
        () => computeViewBox(gridSize, hexSize, borderHexes),
        [gridSize, hexSize, borderHexes]
    );

    const innerSize = hexSize - 3;
    const borderSize = hexSize - 2;

    return (
        <div className="w-full h-full flex items-center justify-center">
            <svg
                viewBox={viewBox}
                width="100%"
                style={{ maxWidth: 900, display: "block" }}
                xmlns="http://www.w3.org/2000/svg"
            >
                

                {/* Border hexagons */}
                {borderHexes.map((bh, i) => {
                    const { cx, cy } = hexCenter(bh.row, bh.col, hexSize);
                    const fill = bh.team === "orange" ? "#f97316" : "#22c55e";
                    const stroke = bh.team === "orange" ? "#ea580c" : "#16a34a";
                    return (
                        <polygon
                            key={`b-${i}`}
                            points={hexPoints(cx, cy, borderSize)}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={1.5}
                            opacity={0.8}
                        />
                    );
                })}

                {/* Main grid hexagons */}
                {grid.flat().map((cell) => {
                    const { cx, cy } = hexCenter(cell.row, cell.col, hexSize);
                    const points = hexPoints(cx, cy, innerSize);
                    const isOwned = cell.owner !== null;
                    const colors = cell.isSelected
                        ? TEAM_COLORS.selected
                        : isOwned
                            ? TEAM_COLORS[cell.owner as keyof typeof TEAM_COLORS] ?? TEAM_COLORS.empty
                            : TEAM_COLORS.empty;
                    const canClick = interactive && !isOwned && !cell.isSelected;
                    const canChangeOwner = isGameMaster && isOwned && !cell.isSelected;
                    
                    const handleClick = () => {
                        if (canClick) {
                            onCellClick?.(cell.id);
                        } else if (canChangeOwner) {
                            onOwnedCellClick?.(cell.id, cell.owner!);
                        }
                    };

                    return (
                        <g
                            key={cell.id}
                            className={canClick || canChangeOwner ? "hex-cell" : ""}
                            onClick={handleClick}
                            style={{ cursor: canClick || canChangeOwner ? "pointer" : "default" }}
                        >
                            <polygon
                                points={hexPoints(cx, cy, innerSize + 4)}
                                fill="none"
                                stroke={colors.stroke}
                                strokeWidth={cell.isSelected ? 3 : 1.5}
                                opacity={0.6}
                                
                            />
                            <polygon
                                points={points}
                                fill={colors.fill}
                                stroke={colors.stroke}
                                strokeWidth={cell.isSelected ? 2.5 : 1.5}
                                
                            />
                            <text
                                x={cx}
                                y={cy + 1}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill={colors.text}
                                fontSize={hexSize * 0.5}
                                fontFamily="Cairo, Arial"
                                fontWeight="900"
                                style={{ userSelect: "none", pointerEvents: "none" }}
                            >
                                {cell.letter}
                            </text>
                            {isOwned && (
                                <circle
                                    cx={cx}
                                    cy={cy - innerSize * 0.55}
                                    r={4}
                                    fill={colors.stroke}
                                    opacity={0.9}
                                />
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
});

export default HexGrid;

