namespace Tally.Api;

// Amounts are always integers in minor units (kobo, cents).

public record CreateGroupRequest(string Name, string Currency, List<string> Members);
public record AddMemberRequest(string Name);
public record ShareInput(string MemberId, long Share);
public record AddExpenseRequest(string Description, long Amount, string PaidBy, DateOnly? SpentOn, List<ShareInput> Shares);
public record AddPaymentRequest(string From, string To, long Amount, DateOnly? SpentOn);

public record MemberDto(string Id, string Name);
public record ShareDto(string MemberId, long Share);
public record ExpenseDto(string Id, string Kind, string Description, long Amount, string PaidBy, DateOnly SpentOn, DateTime CreatedAt, List<ShareDto> Shares);
public record BalanceDto(string MemberId, long Paid, long Owed, long Net);
public record TransferDto(string From, string To, long Amount);
public record GroupDto(
    string Id,
    string Name,
    string Currency,
    DateTime CreatedAt,
    List<MemberDto> Members,
    List<ExpenseDto> Expenses,
    List<BalanceDto> Balances,
    List<TransferDto> SettleUp,
    long TotalSpent);
