import { sb } from "./supabase.js";

const originalInvoke = sb.functions.invoke.bind(sb.functions);

sb.functions.invoke = async (functionName, options = {}) => {
  const primary = await originalInvoke(functionName, options);
  if (functionName !== "duty-bot" || !primary?.error) return primary;

  try {
    const fallback = await originalInvoke("duty-bot-public-v2", options);
    if (!fallback?.error && fallback?.data?.answer) {
      return {
        ...fallback,
        data: {
          ...fallback.data,
          fallback: "public-duty-engine",
        },
      };
    }
  } catch (_) {}

  return primary;
};
