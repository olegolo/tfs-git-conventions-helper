# tfs-git-conventions-helper
It generates branch names and commit messages according to the convention and copies them to clipboard so you can paste it anywhere (terminal, gui)
# Building
```npm install```

```npm run build```

# Installation
* Go to Extensions and enable 'Developer mode'
* Download the latest **[Release](https://github.com/olegolo/tfs-git-conventions-helper/releases)** and 
* unzip it somewhere. **Unpacked files are still needed after installation** (skip if you've cloned the repo and want to build it by yourself)
* Click 'Load unpacked' and point to '/dist' folder
* Extension should appear in the list

![enable in chrome](/docs/enable_in_chrome1.png)
# Usage
* Open a workitem and find new buttons next to a title 
  
  ![new buttons](/docs/usage_task1.png)
* Clicking on the 'Commit Message' button will generate a text to the clipboard following the pattern ```#parentPbiId #taskId PbiTitle``` e.g. ```#117413 #117414 Implement all data sources for existing forms```
* Clicking on the 'Branch Name' button will generate a text to the clipboard following the pattern ```_parentPbiId_taskId_pbiTitleEscaped``` e.g. ```_117413_Implement_all_data_sources_for_existing_forms```.  
* Since it's being copied to the clipboard all that remains is to paste it into terminal or any gui for git.

## Notes
* It will not mention a parent item in the generated message if the workitem is not a task, may be convenient if there are no tasks in the Pbi or Bug.
* Branch names generated don't include module prefixes so don't forget to prepend it by yourself (until implemented here).
