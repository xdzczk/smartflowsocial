import { ContestNewPage } from "~/features/contest";
import { contestNewAction } from "~/features/contest/contest-new-route.action.server";
import { contestNewLoader } from "~/features/contest/contest-new-route.loader.server";

export const loader = contestNewLoader;
export const action = contestNewAction;
export default ContestNewPage;
