-- New mandate types for office accounts. Kept in a file of its own because a new
-- enum value cannot be used in the transaction that adds it (see 0010).
set search_path = politique, extensions, public;

alter type mandate_type add value if not exists 'vice_president';
alter type mandate_type add value if not exists 'premier_ministre';
alter type mandate_type add value if not exists 'president_institution';
alter type mandate_type add value if not exists 'prefet';
alter type mandate_type add value if not exists 'sous_prefet';
