using System.Security.Cryptography;
using Npgsql;

namespace Tally.Api;

public class Store(NpgsqlDataSource ds)
{
    const string Schema = """
        create table if not exists groups (
          id text primary key,
          name text not null,
          currency text not null default 'NGN',
          created_at timestamptz not null default now()
        );
        create table if not exists members (
          id text primary key,
          group_id text not null references groups(id) on delete cascade,
          name text not null,
          position int not null default 0
        );
        create index if not exists members_group on members(group_id);
        create table if not exists expenses (
          id text primary key,
          group_id text not null references groups(id) on delete cascade,
          kind text not null default 'expense',
          description text not null,
          amount bigint not null,
          paid_by text not null references members(id) on delete cascade,
          spent_on date not null default current_date,
          created_at timestamptz not null default now()
        );
        create index if not exists expenses_group on expenses(group_id);
        create table if not exists expense_shares (
          expense_id text not null references expenses(id) on delete cascade,
          member_id text not null references members(id) on delete cascade,
          share bigint not null,
          primary key (expense_id, member_id)
        );
        """;

    public async Task EnsureSchemaAsync(ILogger log, CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await using var cmd = ds.CreateCommand(Schema);
                await cmd.ExecuteNonQueryAsync(ct);
                return;
            }
            catch (Exception ex) when (attempt < 10 && ex is not OperationCanceledException)
            {
                log.LogWarning(ex, "Database not ready (attempt {Attempt}), retrying", attempt);
                await Task.Delay(TimeSpan.FromSeconds(3), ct);
            }
        }
    }

    public static string NewId(int length = 12)
    {
        const string alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
        return RandomNumberGenerator.GetString(alphabet, length);
    }

    public async Task<string> CreateGroupAsync(string name, string currency, IReadOnlyList<string> members)
    {
        var id = NewId(10);
        await using var conn = await ds.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        await using (var cmd = new NpgsqlCommand("insert into groups (id, name, currency) values ($1, $2, $3)", conn, tx))
        {
            cmd.Parameters.Add(new() { Value = id });
            cmd.Parameters.Add(new() { Value = name });
            cmd.Parameters.Add(new() { Value = currency });
            await cmd.ExecuteNonQueryAsync();
        }
        for (var i = 0; i < members.Count; i++)
            await InsertMemberAsync(conn, tx, id, members[i], i);
        await tx.CommitAsync();
        return id;
    }

    static async Task<string> InsertMemberAsync(NpgsqlConnection conn, NpgsqlTransaction? tx, string groupId, string name, int position)
    {
        var id = NewId();
        await using var cmd = new NpgsqlCommand("insert into members (id, group_id, name, position) values ($1, $2, $3, $4)", conn, tx);
        cmd.Parameters.Add(new() { Value = id });
        cmd.Parameters.Add(new() { Value = groupId });
        cmd.Parameters.Add(new() { Value = name });
        cmd.Parameters.Add(new() { Value = position });
        await cmd.ExecuteNonQueryAsync();
        return id;
    }

    public async Task<string?> AddMemberAsync(string groupId, string name)
    {
        await using var conn = await ds.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        if (!await GroupExistsAsync(conn, tx, groupId)) return null;
        int position;
        await using (var cmd = new NpgsqlCommand("select coalesce(max(position) + 1, 0) from members where group_id = $1", conn, tx))
        {
            cmd.Parameters.Add(new() { Value = groupId });
            position = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        }
        var id = await InsertMemberAsync(conn, tx, groupId, name, position);
        await tx.CommitAsync();
        return id;
    }

    static async Task<bool> GroupExistsAsync(NpgsqlConnection conn, NpgsqlTransaction? tx, string groupId)
    {
        await using var cmd = new NpgsqlCommand("select 1 from groups where id = $1", conn, tx);
        cmd.Parameters.Add(new() { Value = groupId });
        return await cmd.ExecuteScalarAsync() is not null;
    }

    public async Task<HashSet<string>> MemberIdsAsync(string groupId)
    {
        await using var cmd = ds.CreateCommand("select id from members where group_id = $1");
        cmd.Parameters.Add(new() { Value = groupId });
        var ids = new HashSet<string>();
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync()) ids.Add(r.GetString(0));
        return ids;
    }

    public async Task<string> AddExpenseAsync(string groupId, string kind, string description, long amount, string paidBy, DateOnly spentOn, IReadOnlyList<ShareInput> shares)
    {
        var id = NewId();
        await using var conn = await ds.OpenConnectionAsync();
        await using var tx = await conn.BeginTransactionAsync();
        await using (var cmd = new NpgsqlCommand(
            "insert into expenses (id, group_id, kind, description, amount, paid_by, spent_on) values ($1, $2, $3, $4, $5, $6, $7)", conn, tx))
        {
            cmd.Parameters.Add(new() { Value = id });
            cmd.Parameters.Add(new() { Value = groupId });
            cmd.Parameters.Add(new() { Value = kind });
            cmd.Parameters.Add(new() { Value = description });
            cmd.Parameters.Add(new() { Value = amount });
            cmd.Parameters.Add(new() { Value = paidBy });
            cmd.Parameters.Add(new() { Value = spentOn });
            await cmd.ExecuteNonQueryAsync();
        }
        foreach (var s in shares.Where(s => s.Share > 0))
        {
            await using var cmd = new NpgsqlCommand("insert into expense_shares (expense_id, member_id, share) values ($1, $2, $3)", conn, tx);
            cmd.Parameters.Add(new() { Value = id });
            cmd.Parameters.Add(new() { Value = s.MemberId });
            cmd.Parameters.Add(new() { Value = s.Share });
            await cmd.ExecuteNonQueryAsync();
        }
        await tx.CommitAsync();
        return id;
    }

    public async Task<bool> DeleteExpenseAsync(string groupId, string expenseId)
    {
        await using var cmd = ds.CreateCommand("delete from expenses where id = $1 and group_id = $2");
        cmd.Parameters.Add(new() { Value = expenseId });
        cmd.Parameters.Add(new() { Value = groupId });
        return await cmd.ExecuteNonQueryAsync() > 0;
    }

    public async Task<GroupDto?> GetGroupAsync(string id)
    {
        await using var conn = await ds.OpenConnectionAsync();

        string name, currency; DateTime createdAt;
        await using (var cmd = new NpgsqlCommand("select name, currency, created_at from groups where id = $1", conn))
        {
            cmd.Parameters.Add(new() { Value = id });
            await using var r = await cmd.ExecuteReaderAsync();
            if (!await r.ReadAsync()) return null;
            name = r.GetString(0);
            currency = r.GetString(1);
            createdAt = r.GetDateTime(2);
        }

        var members = new List<MemberDto>();
        await using (var cmd = new NpgsqlCommand("select id, name from members where group_id = $1 order by position, name", conn))
        {
            cmd.Parameters.Add(new() { Value = id });
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync()) members.Add(new MemberDto(r.GetString(0), r.GetString(1)));
        }

        var shares = new Dictionary<string, List<ShareDto>>();
        await using (var cmd = new NpgsqlCommand(
            "select s.expense_id, s.member_id, s.share from expense_shares s join expenses e on e.id = s.expense_id where e.group_id = $1", conn))
        {
            cmd.Parameters.Add(new() { Value = id });
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                var eid = r.GetString(0);
                if (!shares.TryGetValue(eid, out var list)) shares[eid] = list = [];
                list.Add(new ShareDto(r.GetString(1), r.GetInt64(2)));
            }
        }

        var expenses = new List<ExpenseDto>();
        await using (var cmd = new NpgsqlCommand(
            "select id, kind, description, amount, paid_by, spent_on, created_at from expenses where group_id = $1 order by spent_on desc, created_at desc", conn))
        {
            cmd.Parameters.Add(new() { Value = id });
            await using var r = await cmd.ExecuteReaderAsync();
            while (await r.ReadAsync())
            {
                var eid = r.GetString(0);
                expenses.Add(new ExpenseDto(
                    eid, r.GetString(1), r.GetString(2), r.GetInt64(3), r.GetString(4),
                    r.GetFieldValue<DateOnly>(5), r.GetDateTime(6),
                    shares.TryGetValue(eid, out var s) ? s : []));
            }
        }

        var balances = Ledger.Balances(members, expenses);
        var total = expenses.Where(e => e.Kind == "expense").Sum(e => e.Amount);
        return new GroupDto(id, name, currency, createdAt, members, expenses, balances, Ledger.SettleUp(balances), total);
    }
}
