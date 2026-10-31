// Static HTML template. No Vue page/root component and no Markdown hydration.
import { docClasses, layoutScope } from "virtual:ox-islands-styles";
import { escape } from "./html";
export async function theme(payload: any, body: string, ui: any) {
	const t = (key: string) =>
		key.split(".").reduce((value: any, key) => value?.[key], payload.messages);
	const stepped = payload.document._TYPE_ === "STEPPED_GUIDE";
	const showToc = !stepped;
	const toc = payload.document.body?.toc?.links?.length > 0;
	const nav = await ui.render(
		"GNav",
		{ slim: true, disableShadow: true, hasBorder: true },
		{},
		true,
	);
	const aside = await ui.render("DocsAsideNav", {}, {}, true);
	const mobileToc = toc
		? `<details class="peer order-2 flex-grow dark:border-neutral-800 border-l"><summary class="px-3 py-4 cursor-pointer">${escape(t("_docs._toc.title"))}</summary><div class="px-3 pt-4 max-h-[65vh] overflow-y-auto">${await ui.render("DocsTocLinks", {}, {}, true)}</div></details>`
		: "";
	let notice = "";
	if ((payload.locale ?? payload.path.split("/")[1]) !== "ja") {
		const link = await ui.render(
			"GNuxtLink",
			{
				class: "font-bold hover:underline underline-offset-2",
				to: "https://crowdin.com/project/misskey-hub",
				target: "_blank",
			},
			{ default: escape(t("_i18n._missing.linkLabel")) },
		);
		const text = await ui.render(
			"I18nT",
			{ scope: "global", keypath: "_i18n._missing.description", tag: "p" },
			{ link },
		);
		notice = await ui.render(
			"Tip",
			{ class: "mb-6", label: t("_i18n._missing.title") },
			{ default: text },
		);
	}
	if (payload.locale === "th")
		notice += await ui.render(
			"Tip",
			{ class: "mb-6" },
			{
				default:
					'<p>เนื่องจากปัญหาทางเทคนิค การแปลภาษาไทยอาจแสดงไม่ถูกต้องในขณะนี้ Misskey-dev กำลังทำงานเกี่ยวกับปัญหานี้ สำหรับรายละเอียด โปรดตรวจสอบ <a href="https://github.com/misskey-dev/misskey-hub-next/issues/221" target="_blank" rel="noopener" class="font-bold hover:underline underline-offset-2">ที่นี่</a></p>',
			},
		);
	const icon = await ui.render("ExtIcon", { class: "ml-1" });
	const editHref =
		"https://github.com/misskey-dev/misskey-hub-next/tree/master/content/" +
		(payload.document._file ?? "").replace(/^\/?[a-z-]+\//, "ja/");
	const edits = `<div class="mt-8 mb-4 flex flex-wrap justify-end gap-3"><div>${await ui.render("GNuxtLink", { class: "hover:underline underline-offset-4", target: "_blank", to: editHref }, { default: escape(t("_docs._contribute.editThis")) + icon })}</div><div>${await ui.render("GNuxtLink", { class: "hover:underline underline-offset-4", target: "_blank", to: "https://crowdin.com/project/misskey-hub" }, { default: escape(t("_docs._contribute.translateThis")) + icon })}</div></div>`;
	let article = `<div class="markdown-body w-full mb-6">${body}</div>${edits}${await ui.render("DocsPrevNext", { ignoreDirBasedNav: payload.document.ignoreDirBasedNav ?? false })}`;
	if (stepped) article = await ui.render("DocsSteppedGuide", {}, {}, true);
	else if (!payload.document.body)
		article = `<div class="markdown-body"><h1>${escape(payload.document.title ?? payload.document._dir?.title)}</h1>${await ui.render("MkIndex", { isDir: true })}</div>`;
	const desktopToc = showToc
		? `<div class="hidden lg:block text-sm"><div class="sticky top-[65px] h-[calc(100vh-4rem)] overflow-y-auto py-6 pl-6"><h3 class="font-bold mb-6">${escape(t("_docs._toc.title"))}</h3>${await ui.render("DocsTocLinks", { class: "break-words" }, {}, true)}</div></div>`
		: "";
	return `<div><noscript class="block bg-accent-800 text-white text-center py-1.5 px-3 keep-all relative z-[10005]">Please turn on Javascript from your browser settings.</noscript>
<div class="bg-white dark:bg-neutral-950">${nav}<div class="main-content"><div class="relative container mx-auto max-w-screen-xl p-6 lg:py-0 grid docs-root pb-12" ${layoutScope}>
<div data-ox-aside class="fixed top-[6.75rem] left-0 z-20 w-64 pl-6 transition-transform bg-neutral-50 dark:bg-neutral-900 lg:top-auto lg:bg-transparent dark:lg:bg-transparent lg:pl-0 lg:transform-none lg:relative -translate-x-64"><div class="lg:sticky lg:top-[65px] h-[calc(100vh-6.75rem)] lg:h-[calc(100vh-4rem)] overflow-y-scroll border-r border-neutral-200 dark:border-neutral-700 py-6 pr-3">${aside}</div></div>
<div class="relative"><div data-doc-grid class="grid ${showToc ? docClasses.docsLayoutWithAsideToc : ""}"><div class="lg:hidden sticky top-[58px] -mx-6 -mt-6 w-[calc(100%+3rem)] bg-neutral-50 dark:bg-neutral-900 z-[9890] border-b dark:border-neutral-700 text-sm flex items-start">${mobileToc}<button data-ox-menu class="p-4 order-1 dark:border-neutral-800 peer-open:border-b flex-shrink-0${toc ? "" : " border-r"}">${await ui.render("AsideIcon", { class: "block w-5 h-5" })}</button></div>
<div class="pt-6 p-0 sm:p-12 lg:p-6 w-full min-w-0">${notice}${article}</div>
${desktopToc}</div>
<div data-ox-overlay class="fixed top-16 z-10 w-full h-full lg:hidden transition-opacity bg-black opacity-0 pointer-events-none"></div></div></div></div>${await ui.render("GFooter", { class: "bg-neutral-100 dark:bg-neutral-900" })}</div></div>`;
}
