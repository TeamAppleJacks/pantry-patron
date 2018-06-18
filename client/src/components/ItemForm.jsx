import React from 'react';
import $ from 'jquery';

class ItemForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: ''
    }

    //component-global timer and delay
    this.delay = 2000;
    this.timer;

    // bindings
    this.handleNameChange = this.handleNameChange.bind(this);
    this.handleQuantChange = this.handleQuantChange.bind(this);
    this.handlePriceChange = this.handlePriceChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  // handle value changes
  handleNameChange(e) {
    this.setState({name: e.target.value});

    clearTimeout(this.timer);
  }

  handleQuantChange(e) {
    this.setState({quantity: e.target.value});
  }

  handlePriceChange(e) {
    this.setState({price: e.target.value});
  }

  // handle submit of edit
  handleSubmit() {
    console.log(this.state.name + '!!!!!!')
    let itemName = this.state.name ? this.state.name
    : prompt('There is no such things as a null object in life. Give it a name');

    while(itemName === '') {
      itemName = prompt('Stop trying to be sneaky!');
    }

    let newItem = {
      name: itemName
    };
    // sends the item to the database and returns
    // the item with the corresponding item id
    // then sends it to be added to the list
    newItem = this.transformItem(newItem, (newItem) => {
      this.props.updateItem(newItem, (items) => {

        this.props.setListEntryState({items: items});
        $('.add-item-input').val('');
      });
    });
  }

  transformItem(newItem, callback) {
    /*
    sends the item to the database so we can get an objectId
    */
    $.ajax({
      url: 'search/item',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(newItem),
      success: (data) => {
        callback(JSON.parse(data));
      },
      error: (err) => {
        console.error(err);
      }
    })
  }

  render() {
    return(
      <div align="center">
        <form onSubmit={(e) => {this.handleSubmit(); e.preventDefault()}}>
          <input
            className="add-item-input"
            type="text"
            placeholder="Enter an item..."
            name="item"
            value={this.state.name}
            onChange={this.handleNameChange}/>
            <a onClick={()=> (this.handleSubmit())}>
              <span className="glyphicon glyphicon-plus"></span>
            </a>
        </form>
       </div>
    );
  }
}

export default ItemForm;