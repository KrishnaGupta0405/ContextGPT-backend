import {
  accountMembers,
  ingestionFiles,
  userChatbots,
} from "../../drizzle/schema.ts";
import { eq, and } from "drizzle-orm";
import { db } from "../index.js";
import { ApiError } from "./ApiError.js";
import { validate as isUUID } from "uuid";

// Define Role Hierarchy (higher number = more permissions)
const ROLE_HIERARCHY = {
  SUPER_ADMIN: 40,
  ADMIN: 30,
  MANAGER: 20,
  AGENT: 10,
};

/**
 * Checks if an actor can invite a specific role
 * Rules:
 * - SUPER_ADMIN: Can invite anyone except other SUPER_ADMINs
 * - ADMIN: Can invite ADMIN, MANAGER, AGENT (but NOT SUPER_ADMIN)
 * - MANAGER: Can invite AGENT only (cannot invite other managers)
 * - AGENT: Cannot invite anyone
 *
 * @param {string} actorRole - Role of the person sending the invite
 * @param {string} roleToInvite - Role being assigned
 * @returns {boolean}
 */
export const canInviteRole = (actorRole, roleToInvite) => {
  const actorLevel = ROLE_HIERARCHY[actorRole];
  const targetLevel = ROLE_HIERARCHY[roleToInvite];

  if (!actorLevel || !targetLevel) {
    return false; // Invalid roles
  }

  // SUPER_ADMIN can invite anyone except other SUPER_ADMINs
  if (actorRole === "SUPER_ADMIN") {
    return roleToInvite !== "SUPER_ADMIN";
  }

  // ADMIN can invite ADMIN, MANAGER, AGENT (but not SUPER_ADMIN)
  if (actorRole === "ADMIN") {
    return (
      roleToInvite !== "SUPER_ADMIN" && targetLevel <= ROLE_HIERARCHY.ADMIN
    );
  }

  // MANAGER can invite AGENT only
  if (actorRole === "MANAGER") {
    return roleToInvite === "AGENT";
  }

  // AGENT cannot invite anyone
  return false;
};

/**
 * Checks if an actor can remove/edit another member
 * Generally, you can only manage people BELOW you in hierarchy
 * NOTE: No one can manage the account owner, regardless of their role
 *
 * @param {string} actorRole - Role of the person performing action
 * @param {string} targetRole - Role of the person being managed
 * @param {string} accountId - Account ID to check ownership
 * @param {string} targetUserId - Target user ID to check if they are the owner
 * @param {object} db - Database instance
 * @returns {Promise<boolean>}
 */
export const canManageMember = async (
  actorRole,
  targetRole,
  accountId,
  targetUserId,
  db
) => {
  const actorLevel = ROLE_HIERARCHY[actorRole];
  const targetLevel = ROLE_HIERARCHY[targetRole];

  if (!actorLevel || !targetLevel) {
    return false;
  }

  // Import schema tables dynamically to avoid circular dependencies
  const { accounts } = await import("../../drizzle/schema.ts");
  const { eq } = await import("drizzle-orm");

  // Check if target user is the account owner
  const [account] = await db
    .select({ ownerId: accounts.ownerId })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  // No one can manage the account owner
  if (account && account.ownerId === targetUserId) {
    return false;
  }

  // SUPER_ADMIN can manage anyone except the owner (already checked above)
  if (actorRole === "SUPER_ADMIN") {
    return true;
  }

  // ADMIN can manage MANAGER and AGENT only
  if (actorRole === "ADMIN") {
    return targetRole === "MANAGER" || targetRole === "AGENT";
  }

  // MANAGER can manage AGENT only
  if (actorRole === "MANAGER") {
    return targetRole === "AGENT";
  }

  // AGENT cannot manage anyone
  return false;
};

/**
 * Validates if a role is valid
 * @param {string} role
 * @returns {boolean}
 */
export const isValidRole = (role) => {
  return ["SUPER_ADMIN", "ADMIN", "MANAGER", "AGENT"].includes(role);
};

/**
 * Checks if an actor can perform a specific action
 * @param {string} actorRole - Role of the person
 * @param {string} action - Action to perform (e.g., 'DELETE_CHATBOT', 'EDIT_SETTINGS')
 * @returns {boolean}
 */
export const canPerformAction = (actorRole, action) => {
  const permissions = {
    DELETE_CHATBOT: ["SUPER_ADMIN"],
    EDIT_CHATBOT_SETTINGS: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    VIEW_CHAT_HISTORY: ["SUPER_ADMIN", "ADMIN", "MANAGER", "AGENT"],
    EDIT_CHAT_HISTORY: ["SUPER_ADMIN", "ADMIN", "MANAGER", "AGENT"],
    INVITE_MANAGERS: ["SUPER_ADMIN", "ADMIN", "MANAGER"], // Agent cannot invite
    INGESTION_UPLOAD: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
    INGESTION_VIEW: ["SUPER_ADMIN", "ADMIN", "MANAGER", "AGENT"],
    INGESTION_DELETE: ["SUPER_ADMIN", "ADMIN"],
    INGESTION_UPLOAD: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  };

  return permissions[action]?.includes(actorRole) || false;
};

/**
 * Helper to throw permission error with descriptive message
 * @param {string} actorRole
 * @param {string} action
 * @throws {ApiError}
 */
export const requirePermission = (actorRole, action) => {
  if (!canPerformAction(actorRole, action)) {
    throw new ApiError(
      403,
      `Insufficient permissions: ${actorRole} cannot perform ${action}`
    );
  }
};

export const belongsToAccountMemberList = async (
  account_id,
  user_id,
  requiredAction
) => {
  const [accountMember] = await db
    .select()
    .from(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, account_id),
        eq(accountMembers.userId, user_id)
      )
    )
    .limit(1);

  if (!accountMember) {
    throw new ApiError(403, "User does not have access to this account");
  }

  if (!accountMember.role) {
    throw new ApiError(403, "No role assigned — contact support");
  }

  if (!canPerformAction(accountMember.role, requiredAction)) {
    throw new ApiError(
      403,
      "User does not have permission to perform this action"
    );
  }
  return accountMember;
};

// Permission middleware
// Resolves accountId from chatbotId if present, then checks permissions
export const verifyPermissions = (requiredAction) => async (req, res, next) => {
  try {
    const userId = req.user.id; // From verifyJWT
    let accountId;

    // Resolve accountId based on route params (chatbotId or fileId)

    if (req.params.chatbotId) {
      let chatbot;
      try {
        [chatbot] = await db
          .select({ accountId: userChatbots.accountId })
          .from(userChatbots)
          .where(eq(userChatbots.id, req.params.chatbotId))
          .limit(1);
      } catch (error) {
        throw new ApiError(400, "Invalid Chatbot ID format");
      }

      if (!chatbot) throw new ApiError(404, "Chatbot not found");
      accountId = chatbot.accountId;
    } else if (req.params.fileId) {
      let file;
      try {
        [file] = await db
          .select({ chatbotId: ingestionFiles.chatbotId })
          .from(ingestionFiles)
          .where(eq(ingestionFiles.id, req.params.fileId))
          .limit(1);
      } catch (error) {
        throw new ApiError(400, "Invalid File ID format");
      }

      if (!file) throw new ApiError(404, "File not found");
      let chatbot;
      try {
        [chatbot] = await db
          .select({ accountId: userChatbots.accountId })
          .from(userChatbots)
          .where(eq(userChatbots.id, file.chatbotId))
          .limit(1);
      } catch (error) {
        throw new ApiError(400, "Invalid Chatbot ID format");
      }
      if (!chatbot) throw new ApiError(404, "Chatbot not found");
      accountId = chatbot.accountId;
    } else {
      // For routes without chatbotId/fileId (e.g., /upload uses req.body.chatbotId)
      const { chatbotId } = req.body;
      if (!chatbotId) throw new ApiError(400, "Chatbot ID required");
      let chatbot;
      try {
        [chatbot] = await db
          .select({ accountId: userChatbots.accountId })
          .from(userChatbots)
          .where(eq(userChatbots.id, chatbotId))
          .limit(1);
      } catch (error) {
        throw new ApiError(400, "Invalid Chatbot ID format");
      }
      if (!chatbot) throw new ApiError(404, "Chatbot not found");
      accountId = chatbot.accountId;
    }
    // console.log("Account id is -> ", accountId);
    // console.log("User id is -> ", userId);
    // console.log("Required action is -> ", requiredAction);
    // Now check permissions with resolved accountId
    await belongsToAccountMemberList(accountId, userId, requiredAction);
    next();
  } catch (error) {
    next(error); // Pass ApiError to global handler
  }
};
