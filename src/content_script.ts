import * as $ from 'jquery';
import { copyTextToClipboard } from './clipboardHelper';
import { getWithExpiry, setWithExpiry } from './localStorageHelper';

enum ItemTypes { Task = "Task", Pbi = "Product Backlog Item", Bug = "Bug" };
enum RelTypes { Parent = "System.LinkTypes.Hierarchy-Reverse" };
interface ItemInfoExpandedDto {
    id: number;
    fields: {
        "System.WorkItemType": ItemTypes,
        "System.Title": string
    },
    relations: {
        rel: RelTypes,
        url: string
    }[],
    url: string
}

interface ItemInfo {
    id: number,
    type: string,
    title: string,

    iterationPath: string,
    priority: number,
    effort: number,

    url: string,
}
interface ItemInfoWithParent extends ItemInfo {
    parent?: ItemInfoWithParent,
}

type Activity = "Development" | "Testing"
enum OriginationPrefix { Api = "API: ", Testing = "Testing: ", Ui = "UI: " }

(() => {
    console.log("OG: TFS HELPER LOADED");
    const config = {
        itemContainerSelector: '.workitem-info-bar.workitem-header-bar',
        containerClass: 'og-buttons',
        apiUrl: window.location.href.split('/').slice(0, 5).join('/') + "/_apis/",
        refreshTimeout: 1000 * 1
    };

    const monitorInjections = () => {
        processItemContainers();
        setTimeout(monitorInjections, config.refreshTimeout);
    };

    const processItemContainers = () => {
        getContainers().forEach(processItemContainer);
    };

    const processItemContainer = async (itemContainerElement: HTMLElement) => {
        const container = $(itemContainerElement);

        if (isAlreadyInjected(container))
            return;

        // itemContainerElement.style.backgroundColor = "#5AB"; // visually marking as set

        const itemLink = container.find("a").attr("href");
        if (itemLink == null) {
            console.debug("OG: couldn't find item element yet. Skipping...");
            return;
        }

        const itemId = extractItemId(itemLink);

        if (getWithExpiry(itemId)){
            console.debug("OG: previous request haven't finished yet");
            return;
        }
        setWithExpiry(itemId, itemId); console.debug("OG: setting expiry token"+getWithExpiry(itemId));

        const itemInfo = await requestItemInfoWithParent(itemId);
        console.debug(itemInfo);

        // TODO: Lost inspiration below and till the end func. Hacks, Needs rework
        if (itemInfo.type != ItemTypes.Task) // We don't want generating for other types
            itemInfo.parent = null;

        document.querySelectorAll('.info-text-wrapper').forEach((x: HTMLElement) => x.style.display = "inline");

        if (isAlreadyInjected(container)) {// double checking, raise conditions
            console.debug("OG: buttons already injected");
            return;
        }

        var injectionContainer = $(`<div class=${config.containerClass}></div>`);
        $(itemContainerElement).append(injectionContainer);

        createButton(injectionContainer, "Commit Message", itemInfo.parent
            ? `#${itemInfo.parent.id} #${itemInfo.id} ${itemInfo.parent.title}`
            : `#${itemInfo.id} ${itemInfo.title}`);
        createButton(injectionContainer, "Branch Name", itemInfo.parent
            ? `_${itemInfo.parent.id}_${itemInfo.id}_${escapeGitBranchName(itemInfo.parent.title)}`
            : `_${itemInfo.id}_${escapeGitBranchName(itemInfo.title)}`);

        // tickets
        createAddChildTaskButton(container, "Add Api", itemInfo, "Development", OriginationPrefix.Api);
        createAddChildTaskButton(container, "Add UI", itemInfo, "Development", OriginationPrefix.Ui);
        createAddChildTaskButton(container, "Add Testing", itemInfo, "Testing", OriginationPrefix.Testing);
    };

    const escapeGitBranchName = (text: string) => text.replace(/[\[":?!.*\/\. ]/g, "_");
    const isAlreadyInjected = (container) => $(container).find('.' + config.containerClass).length;

    const createButton = (container, caption: string, text: string): void => {
        var button = $(`<button>${caption}</button>`);
        container.append(button);
        button.on('click', () => {
            copyTextToClipboard(text, container.get(0));
            console.log("OG: copied " + text);
        });
    }

    const createAddChildTaskButton = (container, caption: string, itemInfo: ItemInfo, activity: Activity, titlePrefix: string = ""): void => {
        var button = $(`<button>${caption}</button>`);
        container.append(button);
        button.on('click', async () => {
            button.css("background-color", "wheat");
            console.debug("OG: creating task");
            const resp = await fetch(config.apiUrl + "wit/workitems/$task?api-version=6.0",
                {
                    method: "POST",
                    headers: { 'Content-Type': 'application/json-patch+json' },
                    body: JSON.stringify([
                        {
                            "op": "add",
                            "path": "/fields/System.Title",
                            "from": null,
                            "value": titlePrefix + itemInfo.title
                        },
                        {
                            "op": "add",
                            "path": "/fields/Microsoft.VSTS.Common.Activity",
                            "from": null,
                            "value": activity
                        },
                        {
                            "op": "add",
                            "path": "/fields/System.IterationPath",
                            "from": null,
                            "value": itemInfo.iterationPath
                        },
                        {
                            "op": "add",
                            "path": "/relations/-",
                            "value": {
                                "rel": "System.LinkTypes.Hierarchy-Reverse",
                                "url": itemInfo.url
                            }
                        }
                    ])
                });
            button.css("background-color", "green");
            console.debug(resp.json());
        });
    }

    const requestItemInfoWithParent = async (id: number, withParent = true): Promise<ItemInfoWithParent> => {
        const itemUrl = composeExpandedItemUrl(id);
        console.debug("OG: requesting item info");
        const info: ItemInfoExpandedDto = await fetch(itemUrl).then(response => response.json());
        let result: ItemInfoWithParent = fromDto(info);

        if (!withParent)
            return result;

        const parentRelations = info.relations && info.relations.filter(item => item.rel === RelTypes.Parent);
        if (!parentRelations || !parentRelations.length) {
            console.log(`OG: WARNING: No parent for the item with Id ${id} found`);
            return result;
        }

        const parentItemUrl = parentRelations[0].url; // not expanded
        console.debug("OG: requesting parent item info");
        const parentInfo: ItemInfoExpandedDto = await fetch(parentItemUrl).then(response => response.json());
        result = { ...result, parent: fromDto(parentInfo) };

        return result;
    }

    const fromDto = (info: ItemInfoExpandedDto) => {
        return {
            id: info.id,
            type: info.fields["System.WorkItemType"],
            title: info.fields["System.Title"],
            iterationPath: info.fields["System.IterationPath"],
            priority: info.fields["Microsoft.VSTS.Common.Priority"],
            effort: info.fields["Microsoft.VSTS.Scheduling.Effort"],
            url: info.url
        };
    }

    const composeItemUrl = (id: number): string => `${config.apiUrl}wit/workitems/${id}`;
    const composeExpandedItemUrl = (id: number): string => `${composeItemUrl(id)}?$expand=relations`;
    const getContainers = () => document.querySelectorAll(config.itemContainerSelector);
    const extractItemId = (url: string): number => +url.substring(url.lastIndexOf('/') + 1); // TODO: probably needs regex parsing for safety

    monitorInjections();
})();

