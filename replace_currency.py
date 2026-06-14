import re
import glob

files = glob.glob('frontend/src/**/*.tsx', recursive=True) + glob.glob('frontend/src/**/*.ts', recursive=True)

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    new_content = content
    # Replace $$ -> KSh $
    new_content = new_content.replace('$$', 'KSh $')
    
    # Replace >$ -> >KSh 
    new_content = new_content.replace('>$', '>KSh ')
    
    # Replace ($ -> (KSh 
    new_content = new_content.replace('($', '(KSh ')
    
    # Replace -$ -> -KSh 
    new_content = new_content.replace('-$', '-KSh ')
    
    # Replace : $ -> : KSh 
    new_content = new_content.replace(': $', ': KSh ')
    
    # Specific texts
    new_content = new_content.replace('Discount $', 'Discount KSh')
    new_content = new_content.replace('Cash $', 'Cash KSh')
    new_content = new_content.replace('M-Pesa $', 'M-Pesa KSh')
    new_content = new_content.replace('Card $', 'Card KSh')

    # Lines like: `                        ${parseFloat...` in JSX
    # We can find `^\s*\$\{` and replace with `    KSh ${`
    lines = new_content.split('\n')
    for i in range(len(lines)):
        # If line consists of whitespace followed by ${... and is likely JSX text
        if re.match(r'^\s*\$\{', lines[i]):
            # If it's JSX text, we replace the first $ with KSh 
            # Wait, it could be a template literal in code:
            # `  ${variable}`
            # but usually template literals are inline ` ${var} `
            # Let's see if the line ends with `}` or something.
            # Actually, let's just replace `\$\{` with `KSh \$\{` manually for those specific known lines in POS and ZuriShop
            pass

    new_content = '\n'.join(lines)
    
    if content != new_content:
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
        print('Updated', f)
