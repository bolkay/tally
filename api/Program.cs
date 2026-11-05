using Microsoft.Extensions.FileProviders;
using Npgsql;
using Tally.Api;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? builder.Configuration["DATABASE_URL"]
    ?? throw new InvalidOperationException("Set ConnectionStrings__Default (Fenze sets it when a database is attached).");

builder.Services.AddSingleton(NpgsqlDataSource.Create(ToNpgsql(connectionString)));
builder.Services.AddSingleton<Store>();
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);

var app = builder.Build();

await app.Services.GetRequiredService<Store>().EnsureSchemaAsync(app.Logger, CancellationToken.None);

// ---- Frontend (Next.js static export copied into wwwroot) ----
app.UseDefaultFiles();
app.UseStaticFiles();
// Route only after static files, so "/" serves index.html instead of falling through to the 404 page.
app.UseRouting();

var web = app.Environment.WebRootFileProvider;
app.MapGet("/g/{id}", (string id) => ServePage(web, "g.html"));

// ---- API ----
var api = app.MapGroup("/api");
string[] currencies = ["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR", "CAD"];

app.MapGet("/healthz", () => Results.Ok(new { ok = true }));

api.MapPost("/groups", async (CreateGroupRequest req, Store store) =>
{
    var name = req.Name?.Trim() ?? "";
    var members = (req.Members ?? []).Select(m => m.Trim()).Where(m => m.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    if (name.Length is 0 or > 80) return Problem("Give the group a name of up to 80 characters.");
    if (!currencies.Contains(req.Currency)) return Problem("Pick a supported currency.");
    if (members.Count < 2) return Problem("Add at least two people.");
    if (members.Count > 50 || members.Any(m => m.Length > 40)) return Problem("Keep it to 50 people with names under 40 characters.");
    var id = await store.CreateGroupAsync(name, req.Currency, members);
    return Results.Ok(new { id });
});

api.MapGet("/groups/{id}", async (string id, Store store) =>
    await store.GetGroupAsync(id) is { } g ? Results.Ok(g) : Results.NotFound());

api.MapPost("/groups/{id}/members", async (string id, AddMemberRequest req, Store store) =>
{
    var name = req.Name?.Trim() ?? "";
    if (name.Length is 0 or > 40) return Problem("Names need 1 to 40 characters.");
    var group = await store.GetGroupAsync(id);
    if (group is null) return Results.NotFound();
    if (group.Members.Any(m => string.Equals(m.Name, name, StringComparison.OrdinalIgnoreCase)))
        return Problem($"{name} is already in this group.");
    await store.AddMemberAsync(id, name);
    return Results.Ok(await store.GetGroupAsync(id));
});

api.MapPost("/groups/{id}/expenses", async (string id, AddExpenseRequest req, Store store) =>
{
    var members = await store.MemberIdsAsync(id);
    if (members.Count == 0) return Results.NotFound();
    var description = req.Description?.Trim() ?? "";
    var shares = req.Shares ?? [];
    if (description.Length is 0 or > 120) return Problem("Describe the expense in up to 120 characters.");
    if (req.Amount <= 0 || req.Amount > 100_000_000_000) return Problem("Enter an amount above zero.");
    if (!members.Contains(req.PaidBy)) return Problem("Choose who paid.");
    if (shares.Count == 0 || shares.Any(s => !members.Contains(s.MemberId) || s.Share < 0)) return Problem("Choose who this was for.");
    if (shares.Select(s => s.MemberId).Distinct().Count() != shares.Count) return Problem("Each person can appear once in the split.");
    if (shares.Sum(s => s.Share) != req.Amount) return Problem("The split must add up to the total.");
    await store.AddExpenseAsync(id, "expense", description, req.Amount, req.PaidBy, req.SpentOn ?? DateOnly.FromDateTime(DateTime.UtcNow), shares);
    return Results.Ok(await store.GetGroupAsync(id));
});

api.MapPost("/groups/{id}/payments", async (string id, AddPaymentRequest req, Store store) =>
{
    var members = await store.MemberIdsAsync(id);
    if (members.Count == 0) return Results.NotFound();
    if (!members.Contains(req.From) || !members.Contains(req.To) || req.From == req.To) return Problem("Choose two different people.");
    if (req.Amount <= 0) return Problem("Enter an amount above zero.");
    await store.AddExpenseAsync(id, "payment", "Payment", req.Amount, req.From, req.SpentOn ?? DateOnly.FromDateTime(DateTime.UtcNow), [new ShareInput(req.To, req.Amount)]);
    return Results.Ok(await store.GetGroupAsync(id));
});

api.MapDelete("/groups/{id}/expenses/{expenseId}", async (string id, string expenseId, Store store) =>
    await store.DeleteExpenseAsync(id, expenseId) ? Results.Ok(await store.GetGroupAsync(id)) : Results.NotFound());

app.MapFallback(() => ServePage(web, "404.html", StatusCodes.Status404NotFound));

app.Run();

static IResult Problem(string message) => Results.BadRequest(new { error = message });

static IResult ServePage(IFileProvider files, string path, int status = 200)
{
    var file = files.GetFileInfo(path);
    return file.Exists ? new StatusPage(file, status) : Results.NotFound();
}

static string ToNpgsql(string cs)
{
    if (!cs.StartsWith("postgres://") && !cs.StartsWith("postgresql://")) return cs;
    var uri = new Uri(cs);
    var userInfo = uri.UserInfo.Split(':', 2);
    var b = new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.IsDefaultPort ? 5432 : uri.Port,
        Database = uri.AbsolutePath.TrimStart('/'),
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null,
    };
    return b.ConnectionString;
}

sealed class StatusPage(IFileInfo file, int status) : IResult
{
    public async Task ExecuteAsync(HttpContext ctx)
    {
        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "text/html; charset=utf-8";
        await using var s = file.CreateReadStream();
        await s.CopyToAsync(ctx.Response.Body);
    }
}
