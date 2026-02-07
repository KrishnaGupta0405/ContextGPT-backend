import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { db } from "../index.js";
import { eq, sql, and, inArray, or } from "drizzle-orm";
import { getSafeUser } from "./user.auth.controller.js";
import { randomBytes } from "crypto";

// Import shared user creation helper
import { createNewUser } from "./user.auth.controller.js";

// Import permission utilities
import {
  canInviteRole,
  canManageMember,
  isValidRole,
} from "../utils/permissionUtils.js";

// Import schema tables from drizzle
import {
  users,
  accounts,
  accountMembers,
  accountInvitations,
} from "../../drizzle/schema.ts";

const generateInviteToken = () => randomBytes(10).toString("hex"); // → 20 chars

async function findAndValidateInvitation(token) {
  if (!token?.trim()) {
    throw new ApiError(400, "Invitation token is required");
  }

  const [invitation] = await db
    .select()
    .from(accountInvitations)
    .where(eq(accountInvitations.token, token.trim()))
    .limit(1);

  if (!invitation) {
    throw new ApiError(404, "Invalid invitation token");
  }

  if (invitation.status !== "PENDING") {
    throw new ApiError(
      400,
      `Invitation has already been ${invitation.status.toLowerCase()}`
    );
  }

  const now = new Date();
  const expiresAt = new Date(invitation.expiresAt);
  if (now > expiresAt) {
    await db
      .update(accountInvitations)
      .set({ status: "EXPIRED" })
      .where(eq(accountInvitations.id, invitation.id));
    throw new ApiError(400, "Invitation has expired");
  }

  return invitation;
}

async function markInvitationAccepted(invitationId) {
  await db
    .update(accountInvitations)
    .set({ status: "ACCEPTED" })
    .where(eq(accountInvitations.id, invitationId));
}

async function ensureNotAlreadyMember(accountId, userId) {
  const [member] = await db
    .select()
    .from(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, userId)
      )
    )
    .limit(1);

  if (member) {
    throw new ApiError(
      409,
      `Already a member of this account as ${member.role}`
    );
  }
}

async function addMembership(accountId, userId, role) {
  const [member] = await db
    .insert(accountMembers)
    .values({
      accountId,
      userId,
      role,
    })
    .returning({
      accountId: accountMembers.accountId,
      role: accountMembers.role,
      joinedAt: accountMembers.joinedAt,
    });

  return {
    accountId: member.accountId,
    role: member.role,
    joinedAt: member.joinedAt,
  };
}

// ────────────────────────────────────────────────
//  Invitation Endpoints
// ────────────────────────────────────────────────

export const registerUserWithInvite = asyncHandler(async (req, res) => {
  const { email, name, password } = req.body;
  const inviteToken =
    req.query.inviteToken ?? req.params.invite ?? req.body.inviteToken;

  if (!inviteToken?.trim()) {
    throw new ApiError(400, "Invitation token is required");
  }

  const invitation = await findAndValidateInvitation(inviteToken);

  // Validate the role based on invitation scope
  if (!isValidRole(invitation.role)) {
    throw new ApiError(
      400,
      `Invalid account role in invitation: ${invitation.role}`
    );
  }

  // For new user → email must match (if set on invite)
  if (
    invitation.email &&
    lowercaseTrim(email) !== lowercaseTrim(invitation.email)
  ) {
    throw new ApiError(400, "Email does not match the invitation");
  }

  // Use the centralized user creation helper
  const avatarFile = req.files?.avatar?.[0];
  const { createdUser, createdAccount, accountMember } = await createNewUser({
    email,
    name,
    password,
    avatarFile,
  });

  await markInvitationAccepted(invitation.id);

  // Add to account
  const membership = await addMembership(
    invitation.accountId,
    createdUser.id,
    invitation.role
  );

  const safeUser = getSafeUser(createdUser);

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { user: safeUser, membership },
        "Registered and joined successfully"
      )
    );
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const { inviteToken } = req.body;
  const userId = req.user?.id;

  if (!userId) throw new ApiError(401, "Login required");

  const invitation = await findAndValidateInvitation(inviteToken);

  if (!isValidRole(invitation.role)) {
    throw new ApiError(
      400,
      `Invalid chatbot role in invitation: ${invitation.role}`
    );
  }

  // Email check
  if (
    invitation.email &&
    lowercaseTrim(req.user.email) !== lowercaseTrim(invitation.email)
  ) {
    throw new ApiError(403, "Invitation email mismatch");
  }

  await ensureNotAlreadyMember(invitation.accountId, userId);

  await markInvitationAccepted(invitation.id);

  const membership = await addMembership(
    invitation.accountId,
    userId,
    invitation.role
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        membership,
        `Successfully joined the ${invitation.scope.toLowerCase()}`
      )
    );
});

// Send team invitation (create entry + trigger email)
export const sendTeamInvitation = asyncHandler(async (req, res) => {
  const { email, role: requestedRole } = req.body;
  const invitedById = req.user.id; // from verifyJWT middleware

  if (!email || !requestedRole) {
    throw new ApiError(400, "email and role are required");
  }

  if (!isValidRole(requestedRole)) {
    throw new ApiError(
      400,
      "Invalid account role. Allowed: SUPER_ADMIN, ADMIN, MANAGER, AGENT"
    );
  }

  const cleanEmail = lowercaseTrim(email);

  // Get the user's account membership
  const [userAccount] = await db
    .select()
    .from(accountMembers)
    .where(eq(accountMembers.userId, invitedById))
    .limit(1);

  if (!userAccount) {
    throw new ApiError(403, "You don't belong to any account");
  }

  const targetAccountId = userAccount.accountId;

  // Check if requester has permission to invite this role
  if (!canInviteRole(userAccount.role, requestedRole)) {
    throw new ApiError(
      403,
      `As a ${userAccount.role}, you cannot invite a ${requestedRole} to the account`
    );
  }

  // Check if invited email is already in account
  const [existingMember] = await db
    .select()
    .from(accountMembers)
    .innerJoin(users, eq(accountMembers.userId, users.id))
    .where(
      and(
        eq(accountMembers.accountId, targetAccountId),
        sql`LOWER(${users.email}) = ${cleanEmail}`
      )
    )
    .limit(1);

  if (existingMember) {
    throw new ApiError(409, "This user is already a member of the account");
  }

  // Check if there's already a pending invitation for this account
  const [existingInvite] = await db
    .select()
    .from(accountInvitations)
    .where(
      and(
        eq(accountInvitations.accountId, targetAccountId),
        eq(accountInvitations.email, cleanEmail),
        eq(accountInvitations.status, "PENDING")
      )
    )
    .limit(1);

  if (existingInvite) {
    throw new ApiError(
      409,
      "Pending account invitation already exists for this email"
    );
  }

  const token = generateInviteToken();

  const [invitation] = await db
    .insert(accountInvitations)
    .values({
      accountId: targetAccountId,
      email: cleanEmail,
      role: requestedRole,
      invitedById,
      token,
      expiresAt: sql`NOW() + INTERVAL ${process.env.INVITATION_EXPIRY_INTERVAL || "7 days"}`,
      status: "PENDING",
      scope: "ACCOUNT",
      resourceId: null,
    })
    .returning();

  // TODO: Trigger email, Use AWS SES service

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        invitationId: invitation.id,
        token: invitation.token,
        scope: "ACCOUNT",
      },
      "Account invitation sent successfully"
    )
  );
});

// Get all pending invitations for the logged-in user
export const getUserInvitations = asyncHandler(async (req, res) => {
  const userId = req.user.id; // from verifyJWT middleware

  if (!userId) {
    throw new ApiError(401, "User id not found");
  }

  // Fetch all pending invitations for this user's email
  const invitations = await db
    .select({
      invitationId: accountInvitations.id,
      email: accountInvitations.email,
      role: accountInvitations.role,
      status: accountInvitations.status,
      scope: accountInvitations.scope,
      token: accountInvitations.token,
      createdAt: accountInvitations.createdAt,
      expiresAt: accountInvitations.expiresAt,
      accountId: accountInvitations.accountId,
      accountName: accounts.name,
      inviterName: users.name,
      inviterEmail: users.email,
    })
    .from(accountInvitations)
    .innerJoin(accounts, eq(accountInvitations.accountId, accounts.id))
    .innerJoin(users, eq(accountInvitations.invitedById, users.id))
    .where(eq(accountInvitations.invitedById, userId))
    .orderBy(accountInvitations.createdAt);

  // Check for expired invitations and update them
  const now = new Date();
  const expiredInvitationIds = invitations
    .filter((inv) => new Date(inv.expiresAt) < now)
    .map((inv) => inv.invitationId);

  // Update expired invitations
  if (expiredInvitationIds.length > 0) {
    await db
      .update(accountInvitations)
      .set({ status: "EXPIRED" })
      .where(inArray(accountInvitations.id, expiredInvitationIds));
  }

  // Filter out expired invitations from the response
  const validInvitations = invitations.filter(
    (inv) => new Date(inv.expiresAt) >= now
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        invitations: validInvitations,
        total: validInvitations.length,
      },
      "User invitations fetched successfully"
    )
  );
});

// Resend invitation (refresh token & expiry limit of invitation)
export const resendInvitation = asyncHandler(async (req, res) => {
  const { invitationId } = req.params;
  const userId = req.user.id;

  const [invite] = await db
    .select()
    .from(accountInvitations)
    .where(eq(accountInvitations.id, invitationId))
    .limit(1);

  if (!invite) {
    throw new ApiError(404, "Invitation not found");
  }

  if (invite.invitedById !== userId) {
    throw new ApiError(403, "You can only resend invitations you created");
  }

  if (invite.status !== "PENDING") {
    throw new ApiError(400, `Cannot resend — invitation is ${invite.status}`);
  }

  const newToken = generateInviteToken();

  // Update invitation with new token and expiry
  const [updated] = await db
    .update(accountInvitations)
    .set({
      token: newToken,
      expiresAt: sql`NOW() + INTERVAL ${process.env.INVITATION_EXPIRY_INTERVAL || "7 days"}`,
    })
    .where(eq(accountInvitations.id, invitationId))
    .returning();

  // TODO: re-trigger email with new token, use AWS SES service

  return res.json(
    new ApiResponse(
      200,
      {
        invitationId,
        newToken: updated.token,
        scope: updated.scope,
        email: updated.email,
        role: updated.role,
        expiresAt: updated.expiresAt,
      },
      "Account invitation resent successfully"
    )
  );
});

// Revoke (delete) pending invitation
export const revokeInvitation = asyncHandler(async (req, res) => {
  const { invitationId } = req.params;
  const userId = req.user.id;

  const [invite] = await db
    .select()
    .from(accountInvitations)
    .where(eq(accountInvitations.id, invitationId))
    .limit(1);

  if (!invite) {
    throw new ApiError(404, "Invitation not found");
  }

  if (invite.invitedById !== userId) {
    throw new ApiError(403, "Only the sender can revoke this invitation");
  }

  if (invite.status !== "PENDING") {
    throw new ApiError(400, "Can only revoke pending invitations");
  }

  await db
    .delete(accountInvitations)
    .where(eq(accountInvitations.id, invitationId));

  return res.json(new ApiResponse(200, { invitationId }, "Invitation revoked"));
});

// Anyone can get account members
export const getAccountMembers = asyncHandler(async (req, res) => {
  const { accountId } = req.params;
  const userId = req.user.id;

  // Check if requester is in the account
  const [membership] = await db
    .select({ role: accountMembers.role })
    .from(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, userId)
      )
    )
    .limit(1);

  if (!membership) {
    throw new ApiError(403, "You are not a member of this account");
  }

  // Get all members of the account
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatar: users.avatar,
      role: accountMembers.role,
      joinedAt: accountMembers.joinedAt,
    })
    .from(accountMembers)
    .innerJoin(users, eq(accountMembers.userId, users.id))
    .where(eq(accountMembers.accountId, accountId))
    .orderBy(accountMembers.joinedAt);

  return res.json(
    new ApiResponse(
      200,
      { members, total: members.length },
      "Account members fetched"
    )
  );
});

// Update account member's role
export const updateAccountMemberRole = asyncHandler(async (req, res) => {
  const { accountId, userId: targetUserId } = req.params;
  const { role } = req.body;
  const currentUserId = req.user.id;

  if (!isValidRole(role)) {
    throw new ApiError(
      400,
      "Invalid role, Accepted Roles: SUPER_ADMIN, ADMIN, MANAGER, AGENT"
    );
  }

  // Get current requester's role in this account
  const [requester] = await db
    .select({ role: accountMembers.role })
    .from(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, currentUserId)
      )
    )
    .limit(1);

  if (!requester) {
    throw new ApiError(403, "You are not in this account");
  }

  // Get target member
  const [targetMember] = await db
    .select({ role: accountMembers.role })
    .from(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, targetUserId)
      )
    )
    .limit(1);

  if (!targetMember) {
    throw new ApiError(404, "Account member not found");
  }

  // Check if requester can manage the target member (includes owner check)
  const canManage = await canManageMember(
    requester.role,
    targetMember.role,
    accountId,
    targetUserId,
    db
  );

  if (!canManage) {
    throw new ApiError(
      403,
      `As a ${requester.role}, you cannot manage a ${targetMember.role}`
    );
  }

  // Check if requester can assign the new role
  if (!canInviteRole(requester.role, role)) {
    throw new ApiError(
      403,
      `As a ${requester.role}, you cannot assign the ${role} role`
    );
  }

  // Update role
  const [updated] = await db
    .update(accountMembers)
    .set({
      role,
    })
    .where(
      and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, targetUserId)
      )
    )
    .returning({
      userId: accountMembers.userId,
      role: accountMembers.role,
    });

  if (!updated) {
    throw new ApiError(500, "Failed to update account member role");
  }

  return res.json(new ApiResponse(200, updated, "Role updated successfully"));
});

// Remove account member
export const removeAccountMember = asyncHandler(async (req, res) => {
  const { accountId, userId: targetUserId } = req.params;
  const currentUserId = req.user.id;

  // Check requester permissions
  const [requester] = await db
    .select({ role: accountMembers.role })
    .from(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, currentUserId)
      )
    )
    .limit(1);

  if (!requester) {
    throw new ApiError(403, "You are not in this account");
  }

  // Get target member
  const [target] = await db
    .select({ role: accountMembers.role })
    .from(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, targetUserId)
      )
    )
    .limit(1);

  if (!target) {
    throw new ApiError(404, "Member not found in account");
  }

  // Check if requester can manage the target member (includes owner check)
  const canManage = await canManageMember(
    requester.role,
    target.role,
    accountId,
    targetUserId,
    db
  );

  if (!canManage) {
    throw new ApiError(
      403,
      `As a ${requester.role}, you cannot remove a ${target.role}`
    );
  }

  // Remove member
  await db
    .delete(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, accountId),
        eq(accountMembers.userId, targetUserId)
      )
    );

  return res.json(new ApiResponse(200, {}, "Account member removed"));
});
