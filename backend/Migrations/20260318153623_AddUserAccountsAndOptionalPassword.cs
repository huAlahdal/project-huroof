using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAccountsAndOptionalPassword : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "PasswordHash",
                table: "PersistedSessions",
                type: "TEXT",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldMaxLength: 64);

            migrationBuilder.AddColumn<string>(
                name: "CreatedByUserId",
                table: "PersistedSessions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    Email = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Username = table.Column<string>(type: "TEXT", maxLength: 24, nullable: false),
                    InGameName = table.Column<string>(type: "TEXT", maxLength: 24, nullable: false),
                    PasswordHash = table.Column<string>(type: "TEXT", nullable: false),
                    Role = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false, defaultValue: "Player"),
                    GamesPlayed = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    GamesWon = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "datetime('now')"),
                    LastLoginAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GameHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SessionId = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    UserId = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    Team = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Won = table.Column<bool>(type: "INTEGER", nullable: false),
                    FinalScoreOrange = table.Column<int>(type: "INTEGER", nullable: false),
                    FinalScoreGreen = table.Column<int>(type: "INTEGER", nullable: false),
                    Rounds = table.Column<int>(type: "INTEGER", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "datetime('now')")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GameHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GameHistories_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SessionPlayers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SessionId = table.Column<string>(type: "TEXT", maxLength: 10, nullable: false),
                    UserId = table.Column<string>(type: "TEXT", maxLength: 8, nullable: false),
                    Role = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false, defaultValue: "spectator"),
                    IsHost = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    IsConnected = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    ConnectionId = table.Column<string>(type: "TEXT", nullable: true),
                    JoinedAt = table.Column<DateTime>(type: "TEXT", nullable: false, defaultValueSql: "datetime('now')"),
                    LeftAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SessionPlayers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SessionPlayers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Questions_Category",
                table: "Questions",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_Difficulty",
                table: "Questions",
                column: "Difficulty");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_Letter",
                table: "Questions",
                column: "Letter");

            migrationBuilder.CreateIndex(
                name: "IX_Questions_Letter_Category",
                table: "Questions",
                columns: new[] { "Letter", "Category" });

            migrationBuilder.CreateIndex(
                name: "IX_PersistedSessions_LastActivityAt",
                table: "PersistedSessions",
                column: "LastActivityAt");

            migrationBuilder.CreateIndex(
                name: "IX_PersistedSessions_Phase",
                table: "PersistedSessions",
                column: "Phase");

            migrationBuilder.CreateIndex(
                name: "IX_GameHistories_CompletedAt",
                table: "GameHistories",
                column: "CompletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_GameHistories_SessionId",
                table: "GameHistories",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_GameHistories_UserId",
                table: "GameHistories",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SessionPlayers_SessionId",
                table: "SessionPlayers",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_SessionPlayers_SessionId_UserId",
                table: "SessionPlayers",
                columns: new[] { "SessionId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SessionPlayers_UserId",
                table: "SessionPlayers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GameHistories");

            migrationBuilder.DropTable(
                name: "SessionPlayers");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Questions_Category",
                table: "Questions");

            migrationBuilder.DropIndex(
                name: "IX_Questions_Difficulty",
                table: "Questions");

            migrationBuilder.DropIndex(
                name: "IX_Questions_Letter",
                table: "Questions");

            migrationBuilder.DropIndex(
                name: "IX_Questions_Letter_Category",
                table: "Questions");

            migrationBuilder.DropIndex(
                name: "IX_PersistedSessions_LastActivityAt",
                table: "PersistedSessions");

            migrationBuilder.DropIndex(
                name: "IX_PersistedSessions_Phase",
                table: "PersistedSessions");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "PersistedSessions");

            migrationBuilder.AlterColumn<string>(
                name: "PasswordHash",
                table: "PersistedSessions",
                type: "TEXT",
                maxLength: 64,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldMaxLength: 100,
                oldNullable: true);
        }
    }
}
