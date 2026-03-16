using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddPersistedSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PersistedSessions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    HostPlayerId = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    GridSize = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalRounds = table.Column<int>(type: "INTEGER", nullable: false),
                    CurrentRound = table.Column<int>(type: "INTEGER", nullable: false),
                    MaxPlayersPerTeam = table.Column<int>(type: "INTEGER", nullable: false),
                    Phase = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    SerializedGrid = table.Column<string>(type: "TEXT", nullable: false),
                    SerializedPlayers = table.Column<string>(type: "TEXT", nullable: false),
                    OrangeScore = table.Column<int>(type: "INTEGER", nullable: false),
                    GreenScore = table.Column<int>(type: "INTEGER", nullable: false),
                    SelectedCellId = table.Column<string>(type: "TEXT", nullable: true),
                    SerializedQuestion = table.Column<string>(type: "TEXT", nullable: false),
                    SerializedBuzzer = table.Column<string>(type: "TEXT", nullable: false),
                    RoundWinner = table.Column<string>(type: "TEXT", nullable: true),
                    Version = table.Column<int>(type: "INTEGER", nullable: false),
                    PasswordHash = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "datetime('now')"),
                    LastActivityAt = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "datetime('now')"),
                    ExpiresAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PersistedSessions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PersistedSessions_ExpiresAt",
                table: "PersistedSessions",
                column: "ExpiresAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PersistedSessions");
        }
    }
}
