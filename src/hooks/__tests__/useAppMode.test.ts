import { beforeEach, describe, expect, it } from "vitest";
import { getAppMode } from "../useAppMode";
import { useAuthStore } from "../../stores/authStore";
import { useGroupStore } from "../../stores/groupStore";

describe("getAppMode", () => {
  beforeEach(() => {
    useAuthStore.setState({ userId: null });
    useGroupStore.setState({ groupId: null });
  });

  it("returns solo mode when no group is active", () => {
    useAuthStore.setState({ userId: "user-1" });
    useGroupStore.setState({ groupId: null });

    const mode = getAppMode();
    expect(mode.mode).toBe("solo");
    expect(mode.appTitle).toBe("Meu Estoque");
    expect(mode.prefix).toBe("Meu");
  });

  it("returns shared mode when group is active", () => {
    useAuthStore.setState({ userId: "user-1" });
    useGroupStore.setState({ groupId: "group-1" });

    const mode = getAppMode();
    expect(mode.mode).toBe("shared");
    expect(mode.appTitle).toBe("Nosso Estoque");
    expect(mode.prefix).toBe("Nosso");
  });
});
