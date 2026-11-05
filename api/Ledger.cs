namespace Tally.Api;

public static class Ledger
{
    /// <summary>
    /// Net position per member: positive means the group owes them, negative means they owe.
    /// A payment from A to B is stored as A paying with B taking the whole share, which moves both towards zero.
    /// </summary>
    public static List<BalanceDto> Balances(IEnumerable<MemberDto> members, IEnumerable<ExpenseDto> expenses)
    {
        var paid = members.ToDictionary(m => m.Id, _ => 0L);
        var owed = members.ToDictionary(m => m.Id, _ => 0L);
        foreach (var e in expenses)
        {
            if (paid.ContainsKey(e.PaidBy)) paid[e.PaidBy] += e.Amount;
            foreach (var s in e.Shares)
                if (owed.ContainsKey(s.MemberId)) owed[s.MemberId] += s.Share;
        }
        return members.Select(m => new BalanceDto(m.Id, paid[m.Id], owed[m.Id], paid[m.Id] - owed[m.Id])).ToList();
    }

    /// <summary>Greedy matching of biggest debtor to biggest creditor. Needs at most n-1 transfers.</summary>
    public static List<TransferDto> SettleUp(IEnumerable<BalanceDto> balances)
    {
        var creditors = balances.Where(b => b.Net > 0).Select(b => (b.MemberId, Amount: b.Net)).OrderByDescending(x => x.Amount).ToList();
        var debtors = balances.Where(b => b.Net < 0).Select(b => (b.MemberId, Amount: -b.Net)).OrderByDescending(x => x.Amount).ToList();
        var transfers = new List<TransferDto>();
        int i = 0, j = 0;
        while (i < debtors.Count && j < creditors.Count)
        {
            var pay = Math.Min(debtors[i].Amount, creditors[j].Amount);
            if (pay > 0) transfers.Add(new TransferDto(debtors[i].MemberId, creditors[j].MemberId, pay));
            debtors[i] = (debtors[i].MemberId, debtors[i].Amount - pay);
            creditors[j] = (creditors[j].MemberId, creditors[j].Amount - pay);
            if (debtors[i].Amount == 0) i++;
            if (creditors[j].Amount == 0) j++;
        }
        return transfers;
    }
}
