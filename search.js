// Requires fuse.js imported.


function renderReactants(reactants) {
    const ul = document.createElement('ul')

    reactants.forEach(r => {
        const li = document.createElement('li')
        li.textContent = `${r.amount}  ${r.id}`
        ul.appendChild(li)
    });

    return ul
}

function formatEffect(effect) {
    if (!effect.type || !effect.data) return '';
    
    const type = effect.type;
    
    switch (type) {
        case 'HealthChange':
            const damage = effect.data.damage || {};
            let healingChanges = [];
            let damageChanges = [];
            
            const processChanges = (entries) => {
                Object.entries(entries).forEach(([key, value]) => {
                    const colorClass = value < 0 ? 'healing-value' : 'damage-value';
                    const valueSpan = document.createElement('span');
                    valueSpan.className = colorClass;
                    valueSpan.textContent = Math.abs(value);
                    
                    const change = `${valueSpan.outerHTML} ${key}`;
                    value < 0 ? healingChanges.push(change) : damageChanges.push(change);
                });
            };

            if (damage.types) processChanges(damage.types);
            if (damage.groups) processChanges(damage.groups);

            let result = [];
            if (healingChanges.length > 0) result.push(`Heals ${healingChanges.join(', ')}`);
            if (damageChanges.length > 0) result.push(`Damages ${damageChanges.join(', ')}`);
            return result.join(', ');
            
        case 'GenericStatusEffect':
            return `${effect.data.type || 'Apply'} ${effect.data.key}${effect.data.time ? ` for ${effect.data.time}s` : ''}`;
            
        case 'AdjustReagent':
            return `Adjust ${effect.data.reagent} by ${effect.data.amount}`;
            
        case 'ChemVomit':
            return `Cause vomiting${effect.data.probability ? ` (${effect.data.probability * 100}% chance)` : ''}`;
            
        case 'AdjustTemperature':
            return `Change temperature by ${effect.data.amount}`;
            
        default:
            return type;
    }
}

function formatConditions(conditions) {
    if (!conditions) return '';
    
    function formatRange(min, max, unit = '') {
        const minText = min !== undefined ? `>= ${min}${unit}` : '';
        const maxText = max !== undefined ? `<= ${max}${unit}` : '';
        const connector = minText && maxText ? ' and ' : '';
        return `${minText}${connector}${maxText}`;
    }
    
    return conditions.map(condition => {
        const type = condition.type;
        const data = condition.data;
        
        switch (type) {
            case 'ReagentThreshold':
                const reagentText = data.reagent ? `${data.reagent} ` : 'amount';
                return `when ${reagentText} ${formatRange(data.min, data.max)}`;

            case 'Temperature':
                return `at temperature ${formatRange(data.min, data.max, 'K')}`;

            case 'MobStateCondition':
                return `when ${data.mobstate}`;

            case 'TotalDamage':
                return `when total damage ${formatRange(data.min, data.max)}`;

            default:
                return type;
        }
    }).join(' and ');
}

function renderMetabolismEffects(metabolism) {
    const div = document.createElement('div');
    div.className = 'metabolism-effects';
    
    if (metabolism.effects) {
        metabolism.effects.forEach(effect => {
            const effectDiv = document.createElement('div');
            effectDiv.className = 'effect';
            
            const effectText = formatEffect(effect);
            const conditions = formatConditions(effect.data?.conditions);
            
            effectDiv.innerHTML = effectText + (conditions ? ` ${conditions}` : '');
            div.appendChild(effectDiv);
        });
    }
    
    return div;
}

function renderSearchResults(results, renderOptions) {
    // Display the results
    const resultsContainer = document.getElementById('results')
    resultsContainer.innerHTML = ''

    results.forEach(result => {
        const item = result.item
        const resultItemDiv = document.createElement('div')
        resultItemDiv.className = 'result-item'

        const titleContainer = document.createElement('div')
        titleContainer.className = 'result-item-title-container'
        const title = document.createElement('h3')
        title.textContent = item.id

        titleContainer.appendChild(title)

        if (item.requiredMixerCategories) {
            const requiredMixerCategories = document.createElement('div')
            requiredMixerCategories.textContent = item.requiredMixerCategories.join("")
            requiredMixerCategories.className = 'result-item-mixer'
            titleContainer.appendChild(requiredMixerCategories)
        }

        if (item.minTemp) {
            const temp = document.createElement('div')
            temp.className = 'result-item-temp'
            temp.textContent = `>= ${item.minTemp}K`
            titleContainer.appendChild(temp)
        }

        const reactants = renderReactants(item.reactants)
        resultItemDiv.appendChild(titleContainer)
        resultItemDiv.appendChild(reactants)

        if (renderOptions.includeOutputProduct) {
            const effectsContainerDiv = document.createElement('div')

            item.products.forEach(product => {
                const productOutput = document.createElement('div')
                productOutput.textContent = `Output: ${product.amount} ${product.id}`
                resultItemDiv.appendChild(productOutput);

                if (product.reagentData) {
                    const effectsDiv = document.createElement('div')
                    effectsDiv.className = 'result-item-effects'
                    const productHeader = document.createElement('div')
                    productHeader.className = 'result-item-effects-header'
                    productHeader.textContent = `Effects`
                    effectsDiv.appendChild(productHeader)
                    if (product.reagentData.metabolisms) {
                        Object.entries(product.reagentData.metabolisms).forEach(([key, value]) => {
                            const metabolismDiv = document.createElement('div')
                            metabolismDiv.className = 'metabolism-container'
                            
                            const metabolismEffectsDiv = renderMetabolismEffects(value)
                            metabolismDiv.appendChild(metabolismEffectsDiv)
                            
                            effectsDiv.appendChild(metabolismDiv)
                        })
                    }
                  effectsContainerDiv.appendChild(effectsDiv)
                }

            })

            resultItemDiv.appendChild(effectsContainerDiv)
        }
        resultsContainer.appendChild(resultItemDiv)
    });

    if (results.length === 0) {
        resultsContainer.innerHTML = '<strong>No results found for search</strong>';
    }
}

function runSearch(fuse, data, renderOptions, searchText) {
    // Data is in CamelCase so spaces are harmful for searching right now.
    const cleanedSearchText = searchText.replace(/\s/g, "");
    const searchResults = fuse.search(cleanedSearchText)
    // Fuse will not show entire list if nothing searched :(
    // https://github.com/krisk/Fuse/issues/229
    const results = cleanedSearchText.length > 0
        ? searchResults
        : data.map(item => ({item: item}))
    renderSearchResults(results, renderOptions)
}

function render(data, renderOptions) {
    // Fuse.js options
    const options = {
        keys: ['id', 'reactants.id', 'products.id'],
        threshold: 0.1,
    };


    const fuse = new Fuse(data, options)
    const searchInput = document.getElementById('search-input');

    runSearch(fuse, data, renderOptions || {}, searchInput.value)

    searchInput.addEventListener('input', function (e) {
        runSearch(fuse, data, renderOptions || {}, e.target.value)
    });

}
