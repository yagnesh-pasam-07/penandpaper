-- One time: the owner's account becomes admin (opens Studio, which still needs
-- STUDIO_PASSCODE). An exact email, so no one can get it by choosing a name.
-- If the account doesn't exist yet, this changes nothing; sign up, then run
-- `npm run set-role -- yagnesh@tilicho.in admin`.
UPDATE "users" SET "role" = 'admin' WHERE lower("email") = 'yagnesh@tilicho.in';
