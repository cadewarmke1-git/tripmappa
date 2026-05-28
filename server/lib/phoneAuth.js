/** Create or find a Supabase Auth user by phone and return a client session. */
function syntheticEmailForPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return `phone+${digits}@auth.tripmappa.internal`;
}

async function findUserByPhone(admin, phone) {
  let page = 1;
  while (page <= 5) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find(u => u.phone === phone);
    if (found) return found;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function getOrCreatePhoneUser(admin, phone) {
  let user = await findUserByPhone(admin, phone);
  if (user) return user;

  const email = syntheticEmailForPhone(phone);
  const { data, error } = await admin.auth.admin.createUser({
    phone,
    phone_confirm: true,
    email,
    email_confirm: true,
    user_metadata: { auth_method: "phone_sms" },
  });

  if (error) {
    if (/already|exists|registered/i.test(error.message)) {
      user = await findUserByPhone(admin, phone);
      if (user) return user;
    }
    throw error;
  }
  return data.user;
}

export async function createPhoneSignInSession(admin, phone) {
  const user = await getOrCreatePhoneUser(admin, phone);
  const email = user.email || syntheticEmailForPhone(phone);

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;

  const tokenHash = linkData?.properties?.hashed_token;
  if (!tokenHash) throw new Error("Could not create sign-in session");

  const { data: sessionData, error: sessionError } = await admin.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (sessionError) throw sessionError;
  if (!sessionData?.session) throw new Error("Could not create sign-in session");

  return sessionData.session;
}
