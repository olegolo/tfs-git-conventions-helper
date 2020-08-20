import * as $ from 'jquery';
import { copyTextToClipboard } from './clipboardHelper';

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
    }[]
}

interface ItemInfoWithParent {
    id: number,
    type: string,
    title: string,
    parent?: ItemInfoWithParent
}

(() => {
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
            console.log("couldn't find item element yet. Skipping...");
            return;
        }

        const itemId = extractItemId(itemLink);
        const itemInfo = await requestItemInfoWithParent(itemId);
        console.log(itemInfo);

        // TODO: Lost inspiration below and till the end func. Hacks, Needs rework
        if (itemInfo.type != ItemTypes.Task) // We don't want generating for other types
            itemInfo.parent = null;

        if (isAlreadyInjected(container)) // double checking, raise conditions
            return;

        var injectionContainer = $(`<div class=${config.containerClass}></div>`);
        $(itemContainerElement).append(injectionContainer);

        createButton(injectionContainer, "Commit Message", itemInfo.parent
            ? `#${itemInfo.parent.id} #${itemInfo.id} ${itemInfo.parent.title}`
            : `#${itemInfo.id} ${itemInfo.title}`);
        createButton(injectionContainer, "Branch Name", itemInfo.parent
            ? `_${itemInfo.parent.id}_${itemInfo.id}_${escapeGitBranchName(itemInfo.parent.title)}`
            : `_${itemInfo.id}_${escapeGitBranchName(itemInfo.title)}`);
    };

    const escapeGitBranchName = (text: string) => text.replace(/[\[":?!.*\/\. ]/g, "_");
    const isAlreadyInjected = (container) => $(container).find('.' + config.containerClass).length;

    const createButton = (container, caption: string, text: string): void => {
        var button = $(`<button>${caption}</button>`);
        container.append(button);
        button.on('click', () => {
            copyTextToClipboard(text, container.get(0));
            console.log("copied " + text);
        });
    }

    const requestItemInfoWithParent = async (id: number, withParent = true): Promise<ItemInfoWithParent> => {
        const itemUrl = composeExpandedItemUrl(id);
        const info: ItemInfoExpandedDto = await fetch(itemUrl).then(response => response.json());
        let result: ItemInfoWithParent = fromDto(info);

        if (!withParent)
            return result;

        const parentRelations = info.relations.filter(item => item.rel === RelTypes.Parent);
        if (!parentRelations.length) {
            console.warn(`No parent for the item with Id ${id} found`);
            return result;
        }

        const parentItemUrl = parentRelations[0].url; // not expanded
        const parentInfo: ItemInfoExpandedDto = await fetch(parentItemUrl).then(response => response.json());
        result = { ...result, parent: fromDto(parentInfo) };

        return result;
    }

    const fromDto = (info: ItemInfoExpandedDto) => {
        return {
            id: info.id,
            type: info.fields["System.WorkItemType"],
            title: info.fields["System.Title"],
        };
    }

    const composeItemUrl = (id: number): string => `${config.apiUrl}wit/workitems/${id}`;
    const composeExpandedItemUrl = (id: number): string => `${composeItemUrl(id)}?$expand=relations`;
    const getContainers = () => document.querySelectorAll(config.itemContainerSelector);
    const extractItemId = (url: string): number => +url.substring(url.lastIndexOf('/') + 1); // TODO: probably needs regex parsing for safety


    monitorInjections();
})();

